export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
