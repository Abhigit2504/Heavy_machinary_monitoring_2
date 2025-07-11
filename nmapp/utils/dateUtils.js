// import dayjs from 'dayjs';
// import utc from 'dayjs/plugin/utc';
// import timezone from 'dayjs/plugin/timezone';

// dayjs.extend(utc);
// dayjs.extend(timezone);

// export const buildDateParams = (gfrid, fromDate, toDate, range) => {
//   const tz = "Asia/Kolkata";
//   return {
//     gfrid,
//     from_date: fromDate ? dayjs(fromDate).tz(tz).format("YYYY-MM-DD") : null,
//     to_date: toDate ? dayjs(toDate).tz(tz).format("YYYY-MM-DD") : null,
//     range: range || null,
//   };
// };

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const buildDateParams = (gfrid, fromDate, toDate, range) => {
  const tz = 'Asia/Kolkata';

  const params = {
    gfrid,
    from_date: fromDate
      ? dayjs(fromDate).tz(tz).format('YYYY-MM-DDTHH:mm:ss')
      : null,
    to_date: toDate
      ? dayjs(toDate).tz(tz).format('YYYY-MM-DDTHH:mm:ss')
      : null,
  };

  if (range !== undefined && range !== null) {
    params.range = range;
  }

  return params;
};
