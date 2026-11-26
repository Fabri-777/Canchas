import { todayInLima } from './utils/format.js';

const today = todayInLima();

export const state = {
  user: null,
  court: null,
  date: today,
  today,
  hour: null,
  sport: 'all',
  demo: true,
  adminTab: 'agenda',
  routeToken: 0,
};
