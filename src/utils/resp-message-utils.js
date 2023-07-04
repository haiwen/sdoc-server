export const paramIsRequired = (param) => {
  return { error_msg: `Param ${param} is required` };
};

export const paramIsError = (param) => {
  return { error_msg: `Param ${param} is error` };
};

export const internalServerError = () => {
  return { error_msg: `Internal Server Error` };
};
