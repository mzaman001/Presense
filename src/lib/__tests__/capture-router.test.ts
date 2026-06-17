import { describe, it, expect } from "vitest";
import { routeCapture } from "@/lib/capture-router";

describe("routeCapture", () => {
  const defaults = { nlp_date_parsing: true, smart_routing_enabled: true };

  describe("task routing", () => {
    it("routes task keywords to Do", () => {
      const result = routeCapture("buy milk", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].destination).toBe("Do");
    });

    it("routes 'remind me to' to Do", () => {
      const result = routeCapture("remind me to call mom", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].title).toMatch(/Call mom/i);
    });

    it("strips date text from title", () => {
      const result = routeCapture("buy milk tomorrow at 9pm", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].title).not.toContain("tomorrow at 9pm");
      expect(result[0].deadline).toBeTruthy();
    });

    it("detects recurrence 'every day'", () => {
      const result = routeCapture("every day brush teeth", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=DAILY");
      expect(result[0].title).not.toContain("every day");
    });

    it("detects recurrence 'every Monday and Wednesday'", () => {
      const result = routeCapture("every Monday and Wednesday see Max", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
    });

    it("detects recurrence 'daily'", () => {
      const result = routeCapture("daily meditation", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=DAILY");
    });

    it("detects recurrence 'weekly'", () => {
      const result = routeCapture("weekly report", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=WEEKLY");
    });

    it("detects recurrence 'every other day'", () => {
      const result = routeCapture("every other day exercise", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=DAILY;INTERVAL=2");
    });

    it("detects recurrence 'every weekday'", () => {
      const result = routeCapture("every weekday standup", [], defaults);
      expect(result[0].type).toBe("task");
      expect(result[0].recurrence).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    });

    it("capitalizes first letter of cleaned title", () => {
      const result = routeCapture("buy milk", [], defaults);
      expect(result[0].title).toBe("Buy milk");
    });
  });

  describe("URL routing", () => {
    it("routes URLs to Explore", () => {
      const result = routeCapture("https://example.com/article", [], defaults);
      expect(result[0].type).toBe("explore");
      expect(result[0].destination).toBe("Explore");
      expect(result[0].url).toBe("https://example.com/article");
    });

    it("extracts title from text around URL", () => {
      const result = routeCapture("cool article https://example.com", [], defaults);
      expect(result[0].title).toBe("cool article");
    });
  });

  describe("person note routing", () => {
    it("routes known person + person keyword to Remember", () => {
      const result = routeCapture("Sarah said she needs help", ["Sarah"], defaults);
      expect(result[0].type).toBe("person_note");
      expect(result[0].person).toBe("Sarah");
      expect(result[0].destination).toBe("Remember → People");
    });

    it("strips possessive suffix from name", () => {
      const result = routeCapture("Sarah told me about the project", ["Sarah"], defaults);
      expect(result[0].type).toBe("person_note");
      expect(result[0].person).toBe("Sarah");
    });
  });

  describe("location routing", () => {
    it("routes 'is in' to Locations", () => {
      const result = routeCapture("keys are in the drawer", [], defaults);
      expect(result[0].type).toBe("location");
      expect(result[0].destination).toBe("Remember → Locations");
      expect(result[0].item_name).toBe("Keys");
    });

    it("strips possessive pronouns from item name", () => {
      const result = routeCapture("My purse is in the jacket", [], defaults);
      expect(result[0].item_name).toBe("Purse");
    });

    it("handles 'put it'", () => {
      const result = routeCapture("put it on the shelf", [], defaults);
      expect(result[0].type).toBe("location");
    });

    it("handles 'left it'", () => {
      const result = routeCapture("left it in the car", [], defaults);
      expect(result[0].type).toBe("location");
    });
  });

  describe("thought routing", () => {
    it("routes 'i think' to Think", () => {
      const result = routeCapture("i think this could work", [], defaults);
      expect(result[0].type).toBe("thought");
      expect(result[0].destination).toBe("Think");
    });

    it("routes 'what if' to Think", () => {
      const result = routeCapture("what if we tried a different approach", [], defaults);
      expect(result[0].type).toBe("thought");
    });

    it("routes 'idea:' to Think", () => {
      const result = routeCapture("idea: build a habit tracker", [], defaults);
      expect(result[0].type).toBe("thought");
    });
  });

  describe("explore routing", () => {
    it("routes 'save this' to Explore", () => {
      const result = routeCapture("save this article for later", [], defaults);
      expect(result[0].type).toBe("explore");
      expect(result[0].destination).toBe("Explore");
    });

    it("routes 'interesting' to Explore", () => {
      const result = routeCapture("interesting concept about quantum computing", [], defaults);
      expect(result[0].type).toBe("explore");
    });

    it("routes 'worth reading' to Explore", () => {
      const result = routeCapture("worth reading Atomic Habits by James Clear", [], defaults);
      expect(result[0].type).toBe("explore");
    });
  });

  describe("unknown/inbox routing", () => {
    it("routes unmatched text to Inbox", () => {
      const result = routeCapture("random thought with no keywords", [], defaults);
      expect(result[0].type).toBe("unknown");
      expect(result[0].destination).toBe("Inbox");
    });
  });

  describe("smart routing disabled", () => {
    it("routes everything to Inbox when smart routing is off", () => {
      const result = routeCapture("buy milk tomorrow", [], { smart_routing_enabled: false });
      expect(result[0].type).toBe("unknown");
      expect(result[0].destination).toBe("Inbox");
    });
  });

  describe("multi-segment capture", () => {
    it("splits on 'also' and routes each segment", () => {
      const result = routeCapture("buy milk also call mom", [], defaults);
      expect(result.length).toBe(2);
      expect(result[0].type).toBe("task");
      expect(result[1].type).toBe("task");
    });

    it("splits on '. ' followed by capital letter", () => {
      const result = routeCapture("Buy milk. Call mom", [], defaults);
      expect(result.length).toBe(2);
    });
  });
});
