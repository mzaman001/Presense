"use client";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { logger } from "@/lib/logger";
import React, { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personSchema } from "@/lib/schemas";
import { z } from "zod";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { useRef } from "react";

interface AddPersonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonAdded?: () => void;
}

import { RELATIONSHIP_COLORS } from "@/lib/constants";
import { Icon as UiIcon } from "@/components/ui/Icon";

const COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#64748B", // Slate
];

type PersonFormValues = z.infer<typeof personSchema>;

const DEFAULT_RELATIONSHIPS = [
  "friend",
  "family",
  "professor",
  "colleague",
  "teammate",
  "other",
];

export function AddPersonPanel({
  isOpen,
  onClose,
  onPersonAdded,
}: AddPersonPanelProps) {
  const [color, setColor] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const baselineRef = useRef({
    name: "",
    relationship: "Friend",
    nextMeeting: "",
    notes: "",
    color: null as string | null,
  });

  const { userSettings } = useAppStore();
  const relationships =
    userSettings?.people_categories || DEFAULT_RELATIONSHIPS;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: "",
      relationship: "Friend",
      nextMeeting: "",
      notes: "",
    },
    mode: "onChange",
  });

  const relationshipValue = watch("relationship");

  // BUG-42: RHF's formState.isDirty is non-reactive for unwatched fields and
  // setValue() never marks dirty on its own — compare all field values (plus
  // plain-state `color`) against a baseline captured at open instead.
  const snapshot = () => ({
    name: watch("name") ?? "",
    relationship: watch("relationship") ?? "",
    nextMeeting: watch("nextMeeting") ?? "",
    notes: watch("notes") ?? "",
    color,
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

  // Ensure initial relationship is valid
  React.useEffect(() => {
    if (isOpen) {
      if (!relationships.includes((relationshipValue || "").toLowerCase())) {
        setValue("relationship", relationships[0] || "friend");
      }
      baselineRef.current = snapshot();
      setErrorMsg(null);
    } else {
      reset();
      setColor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onSubmit = async (data: PersonFormValues) => {
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase.from("people").insert({
          user_id: user.id,
          name: data.name.trim(),
          relationship: data.relationship || "friend",
          ...(color ? { color } : {}),
          next_meeting: data.nextMeeting
            ? new Date(data.nextMeeting).toISOString()
            : null,
          notes: data.notes?.trim()
            ? [
                {
                  text: data.notes.trim(),
                  created_at: new Date().toISOString(),
                },
              ]
            : [],
        });

        if (error) {
          logger.error("Insert error:", error);
          setErrorMsg(error.message);
          toast.error("Failed to add person", { description: error.message });
          return;
        }

        toast.success("Person added");
        if (onPersonAdded) onPersonAdded();
        onClose();
      }
    } catch (err: unknown) {
      toast.error("Unexpected error", {
        description:
          (err instanceof Error ? err.message : "Unknown error") ||
          "Could not add person",
      });
    }
  };

  return (
    <>
      <Sheet isOpen={isOpen} onClose={handleClose} title="Add Person">
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

            {/* Name */}
            <Input
              label={
                <>
                  Name <span className="text-red-400">*</span>
                </>
              }
              autoFocus
              inputMode="text"
              autoCapitalize="words"
              placeholder="Person's name..."
              variant="default"
              {...register("name")}
              error={errors.name?.message}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? `name-error` : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit(onSubmit)();
                }
              }}
            />

            {/* Relationship */}
            <div>
              <label className="text-label mb-3 flex items-center gap-2 text-[var(--text-3)]">
                Relationship
              </label>
              <div className="flex flex-wrap gap-2">
                {relationships.map((rel: string) => {
                  const cColor =
                    RELATIONSHIP_COLORS[rel] || "var(--color-text-3)";
                  const isActive =
                    (relationshipValue || "").toLowerCase() ===
                    rel.toLowerCase();
                  return (
                    <button
                      key={rel}
                      type="button"
                      onClick={() =>
                        setValue("relationship", isActive ? "" : rel, {
                          shouldValidate: true,
                        })
                      }
                      style={{
                        borderColor: isActive ? cColor : `${cColor}40`,
                        backgroundColor: isActive
                          ? `${cColor}20`
                          : "transparent",
                        color: isActive ? cColor : "var(--color-text-3)",
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm capitalize transition-all ${
                        isActive
                          ? "font-semibold shadow-sm"
                          : "hover:bg-[var(--color-surface)]"
                      }`}
                    >
                      {rel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-label mb-3 flex items-center justify-between text-[var(--text-3)]">
                <span>Avatar Color</span>
                {color && (
                  <button
                    type="button"
                    onClick={() => setColor(null)}
                    className="text-caption text-[var(--color-text-3)] capitalize transition-colors hover:text-[var(--color-text-1)]"
                  >
                    Clear
                  </button>
                )}
              </label>
              <div className="flex gap-3">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-8 w-8 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "white" : "transparent",
                      transform: color === c ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Next Meeting */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] p-4">
              <label className="text-label mb-3 flex items-center justify-between text-[var(--text-3)]">
                <span className="flex items-center gap-2">
                  <UiIcon
                    size={13}
                    strokeWidth={1.5}
                    className="text-[var(--text-3)]"
                    icon={Calendar}
                  />{" "}
                  Next Meeting (Optional)
                </span>
              </label>
              <input
                type="datetime-local"
                className={
                  errors.nextMeeting
                    ? "!border-red-500 focus:!border-red-500"
                    : ""
                }
                {...register("nextMeeting")}
                aria-invalid={!!errors.nextMeeting}
                aria-describedby={
                  errors.nextMeeting ? `nextMeeting-error` : undefined
                }
              />
              {errors.nextMeeting && (
                <p
                  id="nextMeeting-error"
                  className="text-caption mt-1 text-red-500"
                >
                  {errors.nextMeeting.message}
                </p>
              )}
            </div>

            {/* First Note */}
            <div>
              <label className="text-label mb-3 flex items-center gap-2 text-[var(--text-3)]">
                First Note (Optional)
              </label>
              <TextareaAutosize
                data-testid="autosize-textarea"
                placeholder="What do you want to remember about them?"
                {...register("notes")}
                className={`input resize-none ${errors.notes ? "!border-red-500 focus:!border-red-500" : ""}`}
                minRows={2}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? `notes-error` : undefined}
              />
              {errors.notes && (
                <p id="notes-error" className="text-caption mt-1 text-red-500">
                  {errors.notes.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-4 md:rounded-b-2xl">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isValid}
              className="w-full flex-1 py-3 disabled:opacity-50"
            >
              {isSubmitting ? (
                <UiIcon className="h-5 w-5 animate-spin" icon={Loader2} />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </Sheet>
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
