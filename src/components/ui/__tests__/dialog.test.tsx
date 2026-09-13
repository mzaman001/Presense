import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

describe("Dialog", () => {
  test("is not in the document when closed", () => {
    render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Delete task</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText("Delete task")).not.toBeInTheDocument();
  });

  test("renders its content when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete task</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Delete task")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  test("DialogClose calls onOpenChange(false)", () => {
    let openState = true;
    const handleOpenChange = (next: boolean) => {
      openState = next;
    };
    render(
      <Dialog open={openState} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogTitle>Delete task</DialogTitle>
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(openState).toBe(false);
  });
});
