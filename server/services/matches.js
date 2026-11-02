/**
 * The matches a fan can open. Today there is one replay, but the list shape is what a live feed would fill in.
 * The summary never includes the result, so the card does not spoil the replay.
 */
export function listMatches(match, stoppages) {
  return [summary(match, stoppages)];
}

export function summary(match, stoppages) {
  const count = (type) => stoppages.filter((s) => s.type === type).length;
  return {
    id: match.id, title: match.title, date: match.date ?? null, teams: match.teams,
    maxOvers: match.maxOvers, format: `T${match.maxOvers}`,
    mode: "replay", synthetic: Boolean(match.synthetic),
    deliveries: match.events.length,
    breaks: stoppages.length,
    wickets: match.events.filter((e) => e.wicket).length,
    reviews: count("review"),
  };
}
