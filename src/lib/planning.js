export const PLANNING_COLLECTION = "planning_perso_tasks";

export function parseDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function uniqueStringIds(values) {
  const set = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value || "").trim();
    if (id) set.add(id);
  }
  return Array.from(set);
}

export function normalizeInviteeIds(values, ownerId) {
  return uniqueStringIds(values).filter((id) => id !== String(ownerId || ""));
}

export function overlapsFilter(start, end) {
  return {
    start: { $lt: end },
    end: { $gt: start },
  };
}

export function participationFilter(userIds) {
  return {
    $or: [
      { ownerId: { $in: userIds } },
      { participantIds: { $in: userIds } },
    ],
  };
}

export function buildBusyMap(tasks, userIds) {
  const map = {};
  for (const id of userIds) {
    map[id] = [];
  }

  for (const task of tasks) {
    const involved = uniqueStringIds([task.ownerId, ...(task.participantIds || [])]);
    for (const userId of involved) {
      if (!map[userId]) continue;
      map[userId].push({
        start: task.start,
        end: task.end,
        taskId: String(task._id || task.id || ""),
      });
    }
  }

  return map;
}
