import { Input } from "../ui/Input";
import { useUserId } from "@/components/providers/SessionProvider";
import { logger } from "@/lib/logger";
import React, { useState, useEffect, useRef } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/Sheet";
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
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
  const userId = useUserId();
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

      if (userId) {
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
            user_id: userId,
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
        title={itemToEdit ? "Edit place" : "Remember where"}
        footer={
          <div className="flex items-center gap-2">
            {itemToEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete this place"
                onClick={() => setDeleteConfirm(true)}
                className="text-[var(--text-3)] hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)]"
              >
                <Trash2 aria-hidden="true" className="size-[18px]" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="ml-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="location-form"
              variant="primary"
              disabled={isSubmitting || !isValid}
              className="min-w-28"
            >
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : itemToEdit ? (
                "Save changes"
              ) : (
                "Save"
              )}
            </Button>
          </div>
        }
      >
        <form
          id="location-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 pt-1"
        >
          {errorMsg && (
            <div
              role="alert"
              className="rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-dim)] p-3 text-[length:var(--text-body)] text-[var(--status-danger)]"
            >
              {errorMsg}
            </div>
          )}

          <Input
            label="Item name"
            type="text"
            autoFocus
            placeholder="Keys, passport, the good charger"
            variant="default"
            {...register("itemName")}
            error={errors.itemName?.message}
            aria-invalid={!!errors.itemName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit(onSubmit)();
              }
            }}
          />

          <Input
            label="Location"
            type="text"
            placeholder="Top drawer of the desk"
            variant="default"
            {...register("locationText")}
            error={errors.locationText?.message}
            aria-invalid={!!errors.locationText}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit(onSubmit)();
              }
            }}
          />
        </form>
      </Sheet>
      <ConfirmModal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete this place?"
        description={`"${itemToEdit?.item_name}" and where you kept it will be removed.`}
        confirmLabel="Delete"
        confirmDestructive={true}
      />
      <ConfirmModal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        title="Discard changes?"
        description="What you typed hasn't been saved."
        confirmLabel="Discard"
        confirmDestructive={false}
      />
    </>
  );
}
