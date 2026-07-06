const fs = require("fs");

let f = "src/components/features/PomodoroTimer.tsx";
let c = fs.readFileSync(f, "utf8");
c = c.replaceAll("setNoteText(item.note);", "setNoteText(item.note || \"\");");
fs.writeFileSync(f, c);

f = "src/components/features/SettingsModal.tsx";
c = fs.readFileSync(f, "utf8");
c = c.replaceAll("setSettings(userSettings);", "setSettings(userSettings as any);");
c = c.replaceAll("updateUserSettings(userSettings);", "updateUserSettings(userSettings as any);");
c = c.replaceAll("const updates = { ...settings };", "const updates: any = { ...settings };");
fs.writeFileSync(f, c);

f = "src/components/features/TaskAddPanel.tsx";
c = fs.readFileSync(f, "utf8");
c = c.replaceAll("const exactMatches = peopleMap.filter(p =>", "const exactMatches = (peopleMap as any[]).filter(p =>");
c = c.replaceAll("const dataToInsert = {", "const dataToInsert: any = {");
c = c.replaceAll(".insert(dataToInsert)", ".insert(dataToInsert as any)");
fs.writeFileSync(f, c);

f = "src/components/features/TaskCard.tsx";
c = fs.readFileSync(f, "utf8");
c = c.replaceAll("backgroundColor={person.color}", "backgroundColor={(person.color as BackgroundColor) || undefined}");
fs.writeFileSync(f, c);

console.log("Fixed!");

