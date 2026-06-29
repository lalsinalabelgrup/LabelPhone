/**
 * mockHistory.js
 * Demo call history used by the mock gateway in development / demo mode.
 * Loaded conditionally (only when appConfig.telephonyGateway.mode === 'mock').
 */

const MOCK_HISTORY = [
  { id: 'h1', contactId: 5,  number: '+34 600 100 005', name: 'Elena Soler',   type: 'incoming', duration: 184, label: 'history.today',     time: '14:22' },
  { id: 'h2', contactId: 2,  number: '+34 600 100 002', name: 'Bernat Puig',   type: 'missed',   duration: 0,   label: 'history.today',     time: '11:05' },
  { id: 'h3', contactId: 10, number: '+34 600 100 010', name: 'Jordi Navarro', type: 'outgoing', duration: 423, label: 'history.today',     time: '09:47' },
  { id: 'h4', contactId: 1,  number: '+34 600 100 001', name: 'Ana García',    type: 'incoming', duration: 96,  label: 'history.yesterday', time: '17:30' },
  { id: 'h5', contactId: 3,  number: '+34 600 100 003', name: 'Carme Vidal',   type: 'missed',   duration: 0,   label: 'history.yesterday', time: '10:15' },
  { id: 'h6', contactId: 7,  number: '+34 600 100 007', name: 'Glòria Roca',   type: 'outgoing', duration: 247, label: 'history.lastweek',  time: 'Lun'   },
  { id: 'h7', contactId: 4,  number: '+34 600 100 004', name: 'David Martí',   type: 'incoming', duration: 61,  label: 'history.lastweek',  time: 'Lun'   },
];
