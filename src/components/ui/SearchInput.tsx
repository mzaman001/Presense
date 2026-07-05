import * as React from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { Input, InputProps } from "./Input";
import { Icon as UiIcon } from "@/components/ui/Icon";

export interface SearchInputProps extends Omit<InputProps, "variant"> {}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className={cn("relative w-full", props.hidden && "hidden", className)}>
        <UiIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-3)]" icon={Search} />
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
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
