const fs = require('fs');
const path = require('path');

const file = path.join('src', 'components', 'features', 'TaskAddPanel.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { Icon as UiIcon } from "@/components/ui/Icon";',
  'import { Icon as UiIcon } from "@/components/ui/Icon";\nimport { useForm } from "react-hook-form";\nimport { zodResolver } from "@hookform/resolvers/zod";\nimport { taskSchema } from "@/lib/schemas";\nimport { z } from "zod";\n\ntype TaskFormValues = z.infer<typeof taskSchema>;'
);

content = content.replace(
  'export function TaskAddPanel({ isOpen, onClose, onTaskAdded, taskToEdit, initialDeadline }: TaskAddPanelProps) {',
  'const DEFAULT_DO_CATEGORIES = ["work", "study", "personal", "errand", "health"];\n\nexport function TaskAddPanel({ isOpen, onClose, onTaskAdded, taskToEdit, initialDeadline }: TaskAddPanelProps) {'
);

const stateToReplace = `  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [parsedDeadline, setParsedDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState("");
  const [parsedStartDate, setParsedStartDate] = useState<Date | null>(null);
  const [isManualDate, setIsManualDate] = useState(false);
  const [category, setCategory] = useState("work");
  const [priority, setPriority] = useState<number | null>(null);
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [subtasks, setSubtasks] = useState<{id: string, text: string, completed: boolean}[]>([]);`;

const stateReplacement = `  const queryClient = useQueryClient();
  const [parsedDeadline, setParsedDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState("");
  const [parsedStartDate, setParsedStartDate] = useState<Date | null>(null);
  const [isManualDate, setIsManualDate] = useState(false);
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null);
  const [subtasks, setSubtasks] = useState<{id: string, text: string, completed: boolean}[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      category: "work",
      priority: null,
      deadline: "",
      notes: "",
      first_step: ""
    },
    mode: "onChange"
  });

  const titleValue = watch("title");
  const deadlineValue = watch("deadline");
  const categoryValue = watch("category");
  const priorityValue = watch("priority");
  const notesValue = watch("notes");
  const firstStepValue = watch("first_step");`;

content = content.replace(stateToReplace, stateReplacement);

content = content.replace(
  'setCategoriesList(userSettings?.do_categories || ["work", "study", "personal", "errand", "health"]);',
  'setCategoriesList(userSettings?.do_categories || DEFAULT_DO_CATEGORIES);'
);

content = content.replace(
  '      setCategoriesList(newList);\n      setCategory(name);',
  '      setCategoriesList(newList);\n      setValue("category", name, { shouldValidate: true });'
);

content = content.replace(
  '    } else {\n      setCategory(name);\n    }',
  '    } else {\n      setValue("category", name, { shouldValidate: true });\n    }'
);

const effectToReplace = `  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(taskToEdit.title || "");
        setIsManualDate(false);
        setCategory(taskToEdit.category || "work");
        setPriority(taskToEdit.priority || null);
        setTimeEstimate(taskToEdit.time_estimate || null);
        setNotes(taskToEdit.notes || "");
        setFirstStep(taskToEdit.first_step || "");
        setSubtasks(taskToEdit.subtasks || []);
        setLinkedPeopleIds(taskToEdit.linked_people_ids || []);
        
        if (taskToEdit.recurrence) {
          if (taskToEdit.recurrence === "FREQ=DAILY") setFreq("Daily");
          else if (taskToEdit.recurrence === "FREQ=MONTHLY") setFreq("Monthly");
          else if (taskToEdit.recurrence.includes("FREQ=WEEKLY")) {
            setFreq("Weekly");
            const match = taskToEdit.recurrence.match(/BYDAY=([A-Z,]+)/);
            if (match) setDays(match[1].split(','));
          } else if (taskToEdit.recurrence.includes("INTERVAL=")) {
            setFreq("Custom");
            setCustomRRule(taskToEdit.recurrence);
            // Try to parse interval and freq
            const matchInterval = taskToEdit.recurrence.match(/INTERVAL=(\d+)/);
            if (matchInterval) setCustomInterval(parseInt(matchInterval[1]));
            const matchFreq = taskToEdit.recurrence.match(/FREQ=([A-Z]+)/);
            if (matchFreq) setCustomFreq(matchFreq[1]);
          } else {
            setFreq("Custom");
            setCustomRRule(taskToEdit.recurrence);
          }
        } else {
          setFreq("Does not repeat");
        }
        
        if (taskToEdit.deadline) {
          const d = new Date(taskToEdit.deadline);
          setParsedDeadline(d);
          setDeadline(format(d, "yyyy-MM-dd\\'T\\'HH:mm"));
        } else {
          setParsedDeadline(null);
          setDeadline("");
        }
        
        if (taskToEdit.start_date) {
          const d = new Date(taskToEdit.start_date);
          setParsedStartDate(d);
          setStartDate(format(d, "yyyy-MM-dd\\'T\\'HH:mm"));
        } else {
          setParsedStartDate(null);
          setStartDate("");
        }
      } else {
        setTitle("");
        setDeadline(initialDeadline ? format(initialDeadline, "yyyy-MM-dd\\'T\\'HH:mm") : "");
        setParsedDeadline(initialDeadline ?? null);
        setStartDate("");
        setParsedStartDate(null);
        setFreq("Does not repeat");
        setDays([]);
        setCustomRRule("");
        setIsManualDate(false);
        setCategory("work");
        setPriority(null);
        setTimeEstimate(null);
        setNotes("");
        setFirstStep("");
        setSubtasks([]);
        setLinkedPeopleIds([]);
      }
    }
  }, [isOpen, taskToEdit, initialDeadline]);`;

const effectReplacement = `  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        reset({
          title: taskToEdit.title || "",
          category: taskToEdit.category || "work",
          priority: taskToEdit.priority || null,
          notes: taskToEdit.notes || "",
          first_step: taskToEdit.first_step || "",
          deadline: taskToEdit.deadline ? format(new Date(taskToEdit.deadline), "yyyy-MM-dd'T'HH:mm") : ""
        });
        setIsManualDate(false);
        setTimeEstimate(taskToEdit.time_estimate || null);
        setSubtasks(taskToEdit.subtasks || []);
        setLinkedPeopleIds(taskToEdit.linked_people_ids || []);
        
        if (taskToEdit.recurrence) {
          if (taskToEdit.recurrence === "FREQ=DAILY") setFreq("Daily");
          else if (taskToEdit.recurrence === "FREQ=MONTHLY") setFreq("Monthly");
          else if (taskToEdit.recurrence.includes("FREQ=WEEKLY")) {
            setFreq("Weekly");
            const match = taskToEdit.recurrence.match(/BYDAY=([A-Z,]+)/);
            if (match) setDays(match[1].split(','));
          } else if (taskToEdit.recurrence.includes("INTERVAL=")) {
            setFreq("Custom");
            setCustomRRule(taskToEdit.recurrence);
            // Try to parse interval and freq
            const matchInterval = taskToEdit.recurrence.match(/INTERVAL=(\d+)/);
            if (matchInterval) setCustomInterval(parseInt(matchInterval[1]));
            const matchFreq = taskToEdit.recurrence.match(/FREQ=([A-Z]+)/);
            if (matchFreq) setCustomFreq(matchFreq[1]);
          } else {
            setFreq("Custom");
            setCustomRRule(taskToEdit.recurrence);
          }
        } else {
          setFreq("Does not repeat");
        }
        
        if (taskToEdit.deadline) {
          const d = new Date(taskToEdit.deadline);
          setParsedDeadline(d);
        } else {
          setParsedDeadline(null);
        }
        
        if (taskToEdit.start_date) {
          const d = new Date(taskToEdit.start_date);
          setParsedStartDate(d);
          setStartDate(format(d, "yyyy-MM-dd'T'HH:mm"));
        } else {
          setParsedStartDate(null);
          setStartDate("");
        }
      } else {
        reset({
          title: "",
          category: "work",
          priority: null,
          notes: "",
          first_step: "",
          deadline: initialDeadline ? format(initialDeadline, "yyyy-MM-dd'T'HH:mm") : ""
        });
        setParsedDeadline(initialDeadline ?? null);
        setStartDate("");
        setParsedStartDate(null);
        setFreq("Does not repeat");
        setDays([]);
        setCustomRRule("");
        setIsManualDate(false);
        setTimeEstimate(null);
        setSubtasks([]);
        setLinkedPeopleIds([]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskToEdit, initialDeadline]);`;

content = content.replace(effectToReplace, effectReplacement);

const titleChangeToReplace = `  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isManualDate && userSettings?.nlp_date_parsing !== false) {
      const chrono = await getChrono();
      const parsedResults = chrono.parse(val);
      if (parsedResults && parsedResults.length > 0) {
        let d: Date;
        if (parsedResults.length === 1) {
          d = parsedResults[0].start.date();
        } else {
          // Multiple results: combine their text and re-parse to merge date+time
          // e.g. "tomorrow" + "at 9pm" → "tomorrow at 9pm" → single correct result
          const combined = parsedResults.map((r: any) => r.text).join(" ");
          const merged = chrono.parse(combined);
          d =
            merged.length > 0 && merged[0].start
              ? merged[0].start.date()
              : parsedResults.reduce((a: any, b: any) =>
                  a.start.date() > b.start.date() ? a : b
                ).start.date();
        }
        setParsedDeadline(d);
        setDeadline(format(d, "yyyy-MM-dd\\'T\\'HH:mm"));
      } else {
        setParsedDeadline(null);
        setDeadline("");
      }
    }
  };`;

const titleChangeReplacement = `  const handleTitleChange = async (val: string) => {
    if (!isManualDate && userSettings?.nlp_date_parsing !== false) {
      const chrono = await getChrono();
      const parsedResults = chrono.parse(val);
      if (parsedResults && parsedResults.length > 0) {
        let d: Date;
        if (parsedResults.length === 1) {
          d = parsedResults[0].start.date();
        } else {
          // Multiple results: combine their text and re-parse to merge date+time
          // e.g. "tomorrow" + "at 9pm" → "tomorrow at 9pm" → single correct result
          const combined = parsedResults.map((r: any) => r.text).join(" ");
          const merged = chrono.parse(combined);
          d =
            merged.length > 0 && merged[0].start
              ? merged[0].start.date()
              : parsedResults.reduce((a: any, b: any) =>
                  a.start.date() > b.start.date() ? a : b
                ).start.date();
        }
        setParsedDeadline(d);
        setValue("deadline", format(d, "yyyy-MM-dd'T'HH:mm"), { shouldValidate: true });
      } else {
        setParsedDeadline(null);
        setValue("deadline", "", { shouldValidate: true });
      }
    }
  };`;

content = content.replace(titleChangeToReplace, titleChangeReplacement);

const manualDateToReplace = `  const handleManualDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualDate(true);
    if (e.target.value) {
      setParsedDeadline(new Date(e.target.value));
      setDeadline(e.target.value);
    } else {
      setParsedDeadline(null);
      setDeadline("");
    }
  };`;

const manualDateReplacement = `  const handleManualDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualDate(true);
    if (e.target.value) {
      setParsedDeadline(new Date(e.target.value));
      setValue("deadline", e.target.value, { shouldValidate: true });
    } else {
      setParsedDeadline(null);
      setValue("deadline", "", { shouldValidate: true });
    }
  };`;

content = content.replace(manualDateToReplace, manualDateReplacement);

content = content.replace(
  '      setDeadline("");\n      return;\n    }\n    setParsedDeadline(d);\n    setDeadline(format(d, "yyyy-MM-dd\\'T\\'HH:mm"));',
  '      setValue("deadline", "", { shouldValidate: true });\n      return;\n    }\n    setParsedDeadline(d);\n    setValue("deadline", format(d, "yyyy-MM-dd\\'T\\'HH:mm"), { shouldValidate: true });'
);


const handleSaveToReplace = `  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {


        let finalRecurrence = null;
        if (freq === "Daily") finalRecurrence = "FREQ=DAILY";
        else if (freq === "Monthly") finalRecurrence = "FREQ=MONTHLY";
        else if (freq === "Weekly") {
          finalRecurrence = "FREQ=WEEKLY";
          if (days.length > 0) finalRecurrence += \`;BYDAY=\${days.join(',')}\`;
        } else if (freq === "Custom") {
          if (customInterval > 1) {
            finalRecurrence = \`FREQ=\${customFreq};INTERVAL=\${customInterval}\`;
          } else {
            finalRecurrence = customRRule.trim() || null;
          }
        }

        let finalTitle = title.trim();
        if (parsedDeadline && !isManualDate) {
          const chrono = await getChrono();
          const parsedResults = chrono.parse(finalTitle);
          if (parsedResults && parsedResults.length > 0) {
            parsedResults.forEach((r: any) => {
              finalTitle = finalTitle.replace(r.text, '');
            });
            finalTitle = finalTitle.replace(/\\s+/g, ' ').trim();
            finalTitle = finalTitle.replace(/^(remind me to|remember to|need to|have to|must|gotta)\\s+/i, '');
            if (finalTitle.length > 0) finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
          }
        }

        const payload: Record<string, unknown> = {
          user_id: user.id,
          title: finalTitle || title.trim(),
          first_step: firstStep.trim() || null,
          ifthen_trigger: null,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
          start_date: parsedStartDate ? parsedStartDate.toISOString() : null,
          recurrence: finalRecurrence,
          category,
          status: "active",
          priority: priority ?? 4,
          time_estimate: timeEstimate,
          notes: notes.trim() || null,
          subtasks: subtasks.filter(st => st.text.trim() !== ""),
          linked_people_ids: linkedPeopleIds
        };`;

const handleSaveReplacement = `  const onSubmit = async (data: TaskFormValues) => {
    setSaving(true);
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {


        let finalRecurrence = null;
        if (freq === "Daily") finalRecurrence = "FREQ=DAILY";
        else if (freq === "Monthly") finalRecurrence = "FREQ=MONTHLY";
        else if (freq === "Weekly") {
          finalRecurrence = "FREQ=WEEKLY";
          if (days.length > 0) finalRecurrence += \`;BYDAY=\${days.join(',')}\`;
        } else if (freq === "Custom") {
          if (customInterval > 1) {
            finalRecurrence = \`FREQ=\${customFreq};INTERVAL=\${customInterval}\`;
          } else {
            finalRecurrence = customRRule.trim() || null;
          }
        }

        let finalTitle = data.title.trim();
        if (parsedDeadline && !isManualDate) {
          const chrono = await getChrono();
          const parsedResults = chrono.parse(finalTitle);
          if (parsedResults && parsedResults.length > 0) {
            parsedResults.forEach((r: any) => {
              finalTitle = finalTitle.replace(r.text, '');
            });
            finalTitle = finalTitle.replace(/\\s+/g, ' ').trim();
            finalTitle = finalTitle.replace(/^(remind me to|remember to|need to|have to|must|gotta)\\s+/i, '');
            if (finalTitle.length > 0) finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
          }
        }

        const payload: Record<string, unknown> = {
          user_id: user.id,
          title: finalTitle || data.title.trim(),
          first_step: data.first_step?.trim() || null,
          ifthen_trigger: null,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
          start_date: parsedStartDate ? parsedStartDate.toISOString() : null,
          recurrence: finalRecurrence,
          category: data.category || "work",
          status: "active",
          priority: data.priority ?? 4,
          time_estimate: timeEstimate,
          notes: data.notes?.trim() || null,
          subtasks: subtasks.filter(st => st.text.trim() !== ""),
          linked_people_ids: linkedPeopleIds
        };`;

content = content.replace(handleSaveToReplace, handleSaveReplacement);

content = content.replace(
  '<Sheet isOpen={isOpen} onClose={onClose} title={taskToEdit ? "Edit Task" : "Add Task"}>\n            <div className="flex-1 overflow-y-auto p-6 space-y-6" data-lenis-prevent>',
  '<Sheet isOpen={isOpen} onClose={onClose} title={taskToEdit ? "Edit Task" : "Add Task"}>\n      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">\n            <div className="flex-1 overflow-y-auto p-6 space-y-6" data-lenis-prevent>'
);

const inputToReplace = `<Input
  label={<>Task Name <span className="text-red-400">*</span></>}
                  autoFocus
                  data-autofocus="true"
                  inputMode="text"
                  autoCapitalize="sentences"
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={handleTitleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  variant="title"
/>`;

const inputReplacement = `              <Input
                  label={<>Task Name <span className="text-red-400">*</span></>}
                  autoFocus
                  data-autofocus="true"
                  inputMode="text"
                  autoCapitalize="sentences"
                  placeholder="What needs to be done?"
                  variant="title"
                  {...register("title", {
                    onChange: (e) => handleTitleChange(e.target.value)
                  })}
                  error={errors.title?.message}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? \`title-error\` : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit(onSubmit)();
                    }
                  }}
              />`;

content = content.replace(inputToReplace, inputReplacement);

const firstStepToReplace = `              {/* First Step */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">First Step <span className="text-[var(--text-muted)]">(optional)</span></label>
                <input
                  placeholder="What's the smallest action to start this?"
                  value={firstStep}
                  onChange={(e) => setFirstStep(e.target.value)}
                  
                />
              </div>`;

const firstStepReplacement = `              {/* First Step */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">First Step <span className="text-[var(--text-muted)]">(optional)</span></label>
                <input
                  placeholder="What's the smallest action to start this?"
                  className={cn("input", errors.first_step && "!border-red-500")}
                  {...register("first_step")}
                  aria-invalid={!!errors.first_step}
                  aria-describedby={errors.first_step ? \`first_step-error\` : undefined}
                />
                {errors.first_step && (
                  <p id="first_step-error" className="text-caption text-red-500 mt-1">
                    {errors.first_step.message}
                  </p>
                )}
              </div>`;

content = content.replace(firstStepToReplace, firstStepReplacement);


content = content.replace(
  'deadline ? "bg-[var(--color-text-1)]',
  'deadlineValue ? "bg-[var(--color-text-1)]'
);
content = content.replace(
  '{deadline ? (() => {',
  '{deadlineValue ? (() => {'
);
content = content.replace(
  'const d = new Date(deadline);',
  'const d = new Date(deadlineValue);'
);

const manualDateInputToReplace = `                          <input
                            type="datetime-local"
                            value={deadline || ""}
                            onChange={handleManualDateChange}
                            className="input !py-1.5 !px-2 !text-xs"
                          />`;

const manualDateInputReplacement = `                          <input
                            type="datetime-local"
                            className={cn("input !py-1.5 !px-2 !text-xs", errors.deadline && "!border-red-500")}
                            {...register("deadline", {
                              onChange: handleManualDateChange
                            })}
                            aria-invalid={!!errors.deadline}
                            aria-describedby={errors.deadline ? \`deadline-error\` : undefined}
                          />
                          {errors.deadline && (
                            <p id="deadline-error" className="text-caption text-red-500 mt-1">
                              {errors.deadline.message}
                            </p>
                          )}`;

content = content.replace(manualDateInputToReplace, manualDateInputReplacement);


const priorityToReplace = `onClick={() => setPriority(priority === p.val ? null : p.val)}
                      className={\`px-4 py-2 rounded-full text-xs font-bold transition-all border \${priority === p.val ? p.activeClass : p.colorClass}\`}`;

const priorityReplacement = `onClick={() => setValue("priority", priorityValue === p.val ? null : p.val, { shouldValidate: true })}
                      className={\`px-4 py-2 rounded-full text-xs font-bold transition-all border \${priorityValue === p.val ? p.activeClass : p.colorClass}\`}`;

content = content.replaceAll(priorityToReplace, priorityReplacement);

const catToReplace = `const isActive = category === cat;
                    return (
                      <m.button
                        key={cat}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setCategory(isActive ? "" : cat)}`;

const catReplacement = `const isActive = categoryValue === cat;
                    return (
                      <m.button
                        key={cat}
                        whileTap={{ scale: 0.92 }}
                        type="button"
                        onClick={() => setValue("category", isActive ? "" : cat, { shouldValidate: true })}`;

content = content.replace(catToReplace, catReplacement);

const notesToReplace = `                <TextareaAutosize
                  placeholder="Additional context or details"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  minRows={2}
                  className="input resize-none"
                />`;

const notesReplacement = `                <TextareaAutosize
                  data-testid="autosize-textarea"
                  placeholder="Additional context or details"
                  {...register("notes")}
                  minRows={2}
                  className={cn("input resize-none", errors.notes && "!border-red-500")}
                  aria-invalid={!!errors.notes}
                  aria-describedby={errors.notes ? \`notes-error\` : undefined}
                />
                {errors.notes && (
                  <p id="notes-error" className="text-caption text-red-500 mt-1">
                    {errors.notes.message}
                  </p>
                )}`;

content = content.replace(notesToReplace, notesReplacement);

content = content.replace(
  '              <Button variant="primary"\n                onClick={handleSave}\n                disabled={saving || !title.trim()}\n                className="flex-1  py-3 w-full disabled:opacity-50"\n              >',
  '              <Button type="submit" variant="primary"\n                disabled={isSubmitting || !isValid}\n                className="flex-1  py-3 w-full disabled:opacity-50"\n              >'
);

content = content.replace(
  '    </Sheet>',
  '      </form>\n    </Sheet>'
);

fs.writeFileSync(path.join('scratch', 'rewrite_task.js'), content);
fs.writeFileSync(file, content);
