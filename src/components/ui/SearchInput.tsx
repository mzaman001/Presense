import * as React from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { Input, InputProps } from "./Input";
import { Icon as UiIcon } from "@/components/ui/Icon";

export type SearchInputProps = Omit<InputProps, "variant">;

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn("relative w-full", props.hidden && "hidden", className)}
      >
        <UiIcon
          className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-3)]"
          icon={Search}
        />
        <Input
          ref={ref}
          variant="search"
          type="search"
          className="pl-9"
          {...props}
          hidden={undefined}
        />
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
