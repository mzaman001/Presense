import { describe, it, expect } from "vitest";
import { routeCapture } from "@/lib/capture-router";

describe("routeCapture", () => {
  const defaults = { nlp_date_parsing: true, smart_routing_enabled: true };

  describe("task routing", () => {
    it("returns stable destination ids alongside display labels", async () => {
      const result = await routeCapture(
        "Remind me to submit report tomorrow",
        defaults,
      );
      expect(result[0].destinationId).toBe("do");
      expect(result[0].destination).toBe("Do");
      expect(result[0].confidence).toBeGreaterThan(0);
      expect(result[0].reason).toContain("task");
    });

    it("routes task keywords to Do", async () => {
      const result = await routeCapture("buy milk", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].destination).toBe("Do");
    });

    it("routes 'remind me to' to Do", async () => {
      const result = await routeCapture("remind me to call mom", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].title).toMatch(/Call mom/i);
    });

    it("strips date text from title", async () => {
      const result = await routeCapture("buy milk tomorrow at 9pm", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].title).not.toContain("tomorrow at 9pm");
      expect(result[0].deadline).toBeTruthy();
    });

    it("detects recurrence 'every day'", async () => {
      const result = await routeCapture("every day brush teeth", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=DAILY");
      expect(result[0].title).not.toContain("every day");
    });

    it("detects recurrence 'every Monday and Wednesday'", async () => {
      const result = await routeCapture(
        "every Monday and Wednesday see Max",
        defaults,
      );
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
    });

    // "mon" inside "month" used to match the every-<weekday> pattern, so
    // "every month" saved as weekly on Mondays.
    it("reads 'every month' as monthly, not every Monday", async () => {
      const result = await routeCapture(
        "Pay rent every month on the 1st",
        defaults,
      );
      // Monthly on the 1st: the day of the month is kept too.
      expect(result[0].recurrence).toBe("FREQ=MONTHLY;BYMONTHDAY=1");
      expect(result[0].title).toBe("Pay rent");
    });

    it("still reads 'every mon' and 'every monday' as weekly on Monday", async () => {
      for (const text of ["Gym every mon", "Standup every monday"]) {
        const result = await routeCapture(text, defaults);
        expect(result[0].recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
      }
    });

    it("detects recurrence 'daily'", async () => {
      const result = await routeCapture("daily meditation", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=DAILY");
    });

    it("detects recurrence 'weekly'", async () => {
      const result = await routeCapture("weekly report", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=WEEKLY");
    });

    it("detects recurrence 'every other day'", async () => {
      const result = await routeCapture("every other day exercise", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=DAILY;INTERVAL=2");
    });

    it("detects recurrence 'every weekday'", async () => {
      const result = await routeCapture("every weekday standup", defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    });

    it("capitalizes first letter of cleaned title", async () => {
      const result = await routeCapture("buy milk", defaults);
      expect(result[0].title).toBe("Buy milk");
    });
  });

  describe("everyday task wording", () => {
    it.each([
      "email Sarah about the invoice",
      "text mum",
      "ring the plumber",
      "pick up dry cleaning",
      "renew car insurance",
      "cancel netflix",
      "return the amazon parcel",
      "order more printer ink",
      "reply to John",
      "clean the bathroom",
      "do laundry",
      "write blog post",
      "look into ISA options",
      "Read 'Atomic Habits'",
      "follow up with recruiter",
      "don't forget to water plants",
      "please sort out the car tax",
    ])("sends %s to Do", async (text) => {
      const [item] = await routeCapture(text, defaults);
      expect(item.type).toBe("task");
      expect(item.destinationId).toBe("do");
    });

    it("matches keywords as whole words only", async () => {
      for (const text of [
        "mustard seeds",
        "old notebook",
        "recall that film",
      ]) {
        const [item] = await routeCapture(text, defaults);
        expect(item.type, text).toBe("unknown");
      }
    });

    it("sets the category from a #tag of the user's own categories", async () => {
      const [item] = await routeCapture("vitamins #health", {
        ...defaults,
        do_categories: ["work", "health"],
      });
      expect(item).toMatchObject({
        type: "task",
        title: "Vitamins",
        category: "health",
      });
    });

    it("uses the default categories when the user has none saved", async () => {
      const [item] = await routeCapture("renew insurance #errand", defaults);
      expect(item.category).toBe("errand");
    });

    it("leaves an untagged task uncategorised", async () => {
      const [item] = await routeCapture("buy milk", defaults);
      expect(item.category ?? null).toBeNull();
    });

    it("carries priority and estimate through", async () => {
      const [item] = await routeCapture("p2 30 min run tomorrow", defaults);
      expect(item).toMatchObject({
        type: "task",
        title: "Run",
        priority: 2,
        estimateMinutes: 30,
      });
      expect(item.deadline).toBeTruthy();
    });

    it("reads an idea as a thought even with a task verb in it", async () => {
      const [item] = await routeCapture(
        "idea: call the app Presense",
        defaults,
      );
      expect(item.type).toBe("thought");
    });

    it("reads a shower thought as a thought", async () => {
      const [item] = await routeCapture(
        "shower thought - podcasts about maps",
        defaults,
      );
      expect(item.type).toBe("thought");
    });
  });

  describe("regressions from the adversarial review", () => {
    it("doesn't split after an abbreviation like Dr.", async () => {
      const items = await routeCapture("Call Dr. Smith tomorrow", defaults);
      expect(items.map((i) => i.title)).toEqual(["Call Dr. Smith"]);
    });

    it("splits on 'also' only before a new item", async () => {
      const split = async (t: string) =>
        (await routeCapture(t, defaults)).map((i) => i.title);
      expect(await split("I also need to call the bank")).toEqual([
        "Call the bank",
      ]);
      expect(await split("we should also paint the fence")).toHaveLength(1);
      expect(await split("buy milk and also call the bank")).toEqual([
        "Buy milk",
        "Call the bank",
      ]);
      expect(await split("Buy milk. Also call mom")).toEqual([
        "Buy milk",
        "Call mom",
      ]);
    });

    it("treats an appointment with a time as a task, not a location", async () => {
      const [item] = await routeCapture(
        "the dentist is at 3pm tomorrow",
        defaults,
      );
      expect(item.type).toBe("task");
    });

    it("doesn't file pronouns or 'kept thinking' as locations", async () => {
      for (const text of ["this is in progress", "I kept thinking about it"]) {
        const [item] = await routeCapture(text, defaults);
        expect(item.type, text).not.toBe("location");
      }
    });

    it("doesn't read a question as an instruction", async () => {
      for (const text of ["Do I need a visa?", "Can I pay by card?"]) {
        const [item] = await routeCapture(text, defaults);
        expect(item.type, text).not.toBe("task");
      }
    });

    it("keeps a lowercase word after a full stop in the same item", async () => {
      const items = await routeCapture("meet Sam at 5 p.m. tomorrow", defaults);
      expect(items).toHaveLength(1);
    });

    it("matches whole words only, hyphens included", async () => {
      const [item] = await routeCapture("Post-it notes", defaults);
      expect(item.type).toBe("unknown");
    });

    it("counts an estimate as a task detail", async () => {
      const [item] = await routeCapture("90 min deep work", defaults);
      expect(item).toMatchObject({ type: "task", estimateMinutes: 90 });
    });
  });

  describe("location wording", () => {
    it("reads 'I left my keys in the kitchen drawer'", async () => {
      const [item] = await routeCapture(
        "I left my keys in the kitchen drawer",
        defaults,
      );
      expect(item).toMatchObject({
        type: "location",
        item_name: "Keys",
        title: "kitchen drawer",
      });
    });

    it("keeps prepositions other than in/on/at", async () => {
      const [item] = await routeCapture(
        "I put the spare key under the doormat",
        defaults,
      );
      expect(item).toMatchObject({
        type: "location",
        item_name: "Spare key",
        title: "under the doormat",
      });
    });

    it("does not treat an instruction to put something up as a location", async () => {
      const [item] = await routeCapture(
        "put up shelves in the lounge",
        defaults,
      );
      expect(item.type).toBe("task");
    });
  });

  describe("location routing", () => {
    it("routes 'is in' to Locations", async () => {
      const result = await routeCapture("keys are in the drawer", defaults);
      expect(result[0].type).toBe("location");
      expect(result[0].destination).toBe("Remember → Locations");
      expect(result[0].item_name).toBe("Keys");
    });

    it("strips possessive pronouns from item name", async () => {
      const result = await routeCapture("My purse is in the jacket", defaults);
      expect(result[0].item_name).toBe("Purse");
    });

    it("keeps the original case and splits at the keyword whatever its case", async () => {
      const result = await routeCapture(
        "Passport IS IN the Blue Folder",
        defaults,
      );
      expect(result[0].item_name).toBe("Passport");
      expect(result[0].title).toBe("Blue Folder");
    });

    it("handles 'put it'", async () => {
      const result = await routeCapture("put it on the shelf", defaults);
      expect(result[0].type).toBe("location");
    });

    it("handles 'left it'", async () => {
      const result = await routeCapture("left it in the car", defaults);
      expect(result[0].type).toBe("location");
    });
  });

  describe("thought routing", () => {
    it("routes 'i think' to Think", async () => {
      const result = await routeCapture("i think this could work", defaults);
      expect(result[0].type).toBe("thought");
      expect(result[0].destination).toBe("Think");
    });

    it("routes 'what if' to Think", async () => {
      const result = await routeCapture(
        "what if we tried a different approach",
        defaults,
      );
      expect(result[0].type).toBe("thought");
    });

    it("routes 'idea:' to Think", async () => {
      const result = await routeCapture(
        "idea: build a habit tracker",
        defaults,
      );
      expect(result[0].type).toBe("thought");
    });
  });

  describe("unknown/inbox routing", () => {
    it("routes unmatched text to Inbox", async () => {
      const result = await routeCapture(
        "random thought with no keywords",
        defaults,
      );
      expect(result[0].type).toBe("unknown");
      expect(result[0].destination).toBe("Inbox");
    });
  });

  describe("smart routing disabled", () => {
    it("routes everything to Inbox when smart routing is off", async () => {
      const result = await routeCapture("buy milk tomorrow", {
        smart_routing_enabled: false,
      });
      expect(result[0].type).toBe("unknown");
      expect(result[0].destination).toBe("Inbox");
    });
  });

  describe("multi-segment capture", () => {
    it("splits on 'also' and routes each segment", async () => {
      const result = await routeCapture("buy milk also call mom", defaults);
      expect(result.length).toBe(2);
      expect(result[0].type).toBe("task");
      expect(result[1].type).toBe("task");
    });

    it("splits on '. ' followed by capital letter", async () => {
      const result = await routeCapture("Buy milk. Call mom", defaults);
      expect(result.length).toBe(2);
    });
  });
});
