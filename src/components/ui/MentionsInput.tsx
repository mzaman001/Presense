import React, { useState, useRef } from "react";

interface Person {
  id: string;
  name: string;
}

interface MentionsInputProps {
  value: string;
  onChange: (value: string) => void;
  people: Person[];
}

export function MentionsInput({ value, onChange, people }: MentionsInputProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverSearch, setPopoverSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || textBeforeCursor[lastAtIndex - 1] === " ")) {
      const search = textBeforeCursor.slice(lastAtIndex + 1);
      if (!search.includes(" ")) {
        setShowPopover(true);
        setPopoverSearch(search);
        return;
      }
    }
    setShowPopover(false);
  };

  const handleSelectPerson = (person: Person) => {
    if (!inputRef.current) return;
    const val = value;
    const selectionStart = inputRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const textAfterCursor = val.slice(selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    const mentionText = `@[${person.name}](${person.id})`;
    const newVal = val.slice(0, lastAtIndex) + mentionText + " " + textAfterCursor;
    onChange(newVal);
    setShowPopover(false);

    // Focus input and move cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursorPosition = lastAtIndex + mentionText.length + 1;
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  };

  const filteredPeople = people.filter(p =>
    p.name.toLowerCase().includes(popoverSearch.toLowerCase())
  );

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Type @ to mention people..."
        data-testid="mentions-input"
      />
      {showPopover && filteredPeople.length > 0 && (
        <div
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
          data-testid="mentions-popover"
        >
          {filteredPeople.map((person) => (
            <button
              key={person.id}
              onClick={() => handleSelectPerson(person)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 text-sm text-black"
              type="button"
            >
              {person.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
