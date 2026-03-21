// ════════════════════════════════════════
// PyBolt — Storage Engine
// engine/storage.js
//
// Saves/loads the full IDE state to localStorage.
// Key: 'pybolt_workspace'
// ════════════════════════════════════════

window.PyBoltStorage = (function(){

  const KEY = 'pybolt_workspace';

  function save(state){
    try {
      const data = {
        tabs:        state.tabs,
        folders:     state.folders,
        openTabIds:  [...state.openTabIds],
        activeId:    state.activeId,
        nextId:      state.nextId,
        nextFolderId:state.nextFolderId,
        savedAt:     Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch(e){
      return false;
    }
  }

  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(e){
      return null;
    }
  }

  function clear(){
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch(e){
      return false;
    }
  }

  function exists(){
    return localStorage.getItem(KEY) !== null;
  }

  function savedAt(){
    try {
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      return JSON.parse(raw).savedAt || null;
    } catch(e){ return null; }
  }

  return { save, load, clear, exists, savedAt };

})();
