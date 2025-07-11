// graphUtils.js
import dayjs from 'dayjs';

export const buildApiParams = (gfrid, fromDate, toDate, range) => {
  const params = {
    gfrid,
    from_date: fromDate ? dayjs(fromDate).toISOString() : undefined,
    to_date: toDate ? dayjs(toDate).toISOString() : undefined,
    range: range || undefined
  };
  Object.keys(params).forEach(key => {
    if (params[key] === undefined) {
      delete params[key];
    }
  });
  return params;
};
