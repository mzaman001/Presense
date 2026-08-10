import { Input } from "../ui/Input";
import { logger } from "@/lib/logger";
import React, { useState, useEffect, useRef } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/Sheet";
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { locationSchema } from "@/lib/schemas";
import { z } from "zod";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

interface LocationAddPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationAdded?: () => void;
  /* @todo: Untyped usage justified per TOOL-01 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemToEdit?: any; // To support edit mode
  initialName?: string;
}

type LocationFormValues = z.infer<typeof locationSchema>;

export function LocationAddPanel({
  isOpen,
  onClose,
  onLocationAdded,
  itemToEdit,
  initialName,
}: LocationAddPanelProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      itemName: "",
      locationText: "",
    },
    mode: "onChange",
  });

  // BUG-42: RHF's formState.isDirty is non-reactive for unwatched fields and
  // setValue() never marks dirty on its own — compare field values against a
  // baseline captured at open instead.
  const baselineRef = useRef({ itemName: "", locationText: "" });
  const snapshot = () => ({
    itemName: watch("itemName") ?? "",
    locationText: watch("locationText") ?? "",
  });
  const dirty =
    JSON.stringify(snapshot()) !== JSON.stringify(baselineRef.current);
  useUnsavedGuard(dirty);

  const handleClose = () => {
    if (dirty) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setValue("itemName", itemToEdit.item_name || "");
        setValue("locationText", itemToEdit.location_text || "");
      } else {
        setValue("itemName", initialName || "");
        setValue("locationText", "");
      }
      baselineRef.current = snapshot();
      setErrorMsg(null);
    } else {
      reset();
    }
  }, [isOpen, itemToEdit, initialName, setValue, reset]);

  const onSubmit = async (data: LocationFormValues) => {
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        if (itemToEdit) {
          const { error } = await supabase
            .from("locations")
            .update({
              item_name: data.itemName.trim(),
              location_text: data.locationText.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", itemToEdit.id);

          if (error) throw error;
          toast.success("Location updated");
        } else {
          const { error } = await supabase.from("locations").insert({
            user_id: user.id,
            item_name: data.itemName.trim(),
            location_text: data.locationText.trim(),
          });

          if (error) throw error;
          toast.success("Location logged");
        }

        if (onLocationAdded) onLocationAdded();
        onClose();
      }
    } catch (err: unknown) {
      logger.error("Save error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      toast.error(
        itemToEdit ? "Failed to update location" : "Failed to log location",
        { description: err instanceof Error ? err.message : "Unknown error" },
      );
    }
  };

  const confirmDelete = async () => {
    if (!itemToEdit) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("locations")
        .update(moveItemToTrashPatch())
        .eq("id", itemToEdit.id);
      if (error) throw error;
      toast.success("Location moved to trash");
      if (onLocationAdded) onLocationAdded();
      onClose();
    } catch (err: unknown) {
      toast.error("Failed to delete location", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={handleClose}
        title={itemToEdit ? "Edit Location" : "Log Location"}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex h-full flex-col"
        >
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {errorMsg && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <Input
                label={
                  <>
                    Item Name <span className="text-red-400">*</span>
                  </>
                }
                type="text"
                autoFocus
                placeholder="e.g. Keys, Passport, Charger"
                variant="default"
                {...register("itemName")}
                error={errors.itemName?.message}
                aria-invalid={!!errors.itemName}
                aria-describedby={
                  errors.itemName ? `itemName-error` : undefined
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit(onSubmit)();
                  }
                }}
              />

              <Input
                label={
                  <>
                    Location <span className="text-red-400">*</span>
                  </>
                }
                type="text"
                placeholder="e.g. In the top drawer of my desk"
                variant="default"
                {...register("locationText")}
                error={errors.locationText?.message}
                aria-invalid={!!errors.locationText}
                aria-describedby={
                  errors.locationText ? `locationText-error` : undefined
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit(onSubmit)();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-4 md:rounded-b-2xl">
            {itemToEdit && (
              <Button
                type="button"
                variant="danger"
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center justify-center px-3"
              >
                <UiIcon
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0"
                  icon={Trash2}
                />
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isValid}
              className="w-full flex-1 py-3 disabled:opacity-50"
            >
              {isSubmitting ? (
                <UiIcon
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0 animate-spin"
                  icon={Loader2}
                />
              ) : itemToEdit ? (
                "Save Changes"
              ) : (
                "Log Location"
              )}
            </Button>
          </div>
        </form>
      </Sheet>
      <ConfirmModal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Location"
        description={`Are you sure you want to delete "${itemToEdit?.item_name}"?`}
        confirmLabel="Delete Location"
        confirmDestructive={true}
      />
      <ConfirmModal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        title="Discard Changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        confirmDestructive={false}
      />
    </>
  );
}
