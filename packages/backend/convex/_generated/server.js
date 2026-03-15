export const modules = {};
export const mutation = (obj) => {
  obj.isMutation = true;
  obj.isRegistered = true;
  return obj;
};
export const query = (obj) => {
  obj.isQuery = true;
  obj.isRegistered = true;
  return obj;
};
export const internalMutation = (obj) => {
  obj.isMutation = true;
  obj.isRegistered = true;
  obj.isInternal = true;
  return obj;
};
export const internalQuery = (obj) => {
  obj.isQuery = true;
  obj.isRegistered = true;
  obj.isInternal = true;
  return obj;
};
export const action = (obj) => {
  obj.isAction = true;
  obj.isRegistered = true;
  return obj;
};
export const internalAction = (obj) => {
  obj.isAction = true;
  obj.isRegistered = true;
  obj.isInternal = true;
  return obj;
};
