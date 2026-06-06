import { DEMO_SCENARIO_CATALOG } from "rapid-cortex-shared";

export class DemoService {
  listScenarios() {
    return DEMO_SCENARIO_CATALOG.map(({ id, name, category, valuePitch }) => ({
      id,
      name,
      category,
      valuePitch,
    }));
  }

  startScenario(id: string) {
    const scenario = DEMO_SCENARIO_CATALOG.find((item) => item.id === id);
    if (!scenario) throw new Error("Scenario not found");

    return {
      scenario,
      startedAt: new Date().toISOString(),
      status: "started",
    };
  }
}
