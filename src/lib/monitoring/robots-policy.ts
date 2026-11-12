type RobotsGroup = {
  agents: string[];
  rules: { allow: boolean; path: string }[];
};

export function robotsAllows(robots: string, pathname: string, agent = "jobdraftly") {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      if (field === "disallow" && !value) continue;
      current.rules.push({ allow: field === "allow", path: value });
    }
  }

  const normalizedAgent = agent.toLowerCase();
  const matching = groups.filter((group) =>
    group.agents.some((candidate) =>
      candidate === "*" || normalizedAgent.includes(candidate),
    ),
  );
  const specific = matching.filter((group) =>
    group.agents.some((candidate) => candidate !== "*" && normalizedAgent.includes(candidate)),
  );
  const rules = (specific.length ? specific : matching).flatMap((group) => group.rules);
  const matched = rules
    .filter((rule) => pathname.startsWith(rule.path.replace(/\*.*$/, "")))
    .sort((left, right) => right.path.length - left.path.length || Number(right.allow) - Number(left.allow))[0];
  return matched?.allow ?? true;
}
