/**
 * ws.js — Adwa Bingo WebSocket Client
 * =====================================
 * Drop this file next to index.html and add:
 *   <script src="ws.js"></script>
 * AFTER the socket.io CDN script and BEFORE the closing </body>.
 *
 * The rest of your index.html never calls io() or socket.*  directly.
 * Instead it reads/writes the shared WS object exported here:
 *   window.BingoWS.socket
 *   window.BingoWS.connect(room)
 *   window.BingoWS.switchRoom(oldRoom, newRoom)
 *   window.BingoWS.emitPlayerReady(data)
 *   window.BingoWS.emitDeclareWinner(data)
 *   window.BingoWS.emitRequestCountdown(data)
 *
 * Events received from the server are forwarded to callbacks you register
 * via window.BingoWS.on(eventName, handler).
 */

(function () {
  'use strict';

  var API_BASE = 'https://bi-bo-py.onrender.com';

  // ── Internal socket reference ────────────────────────────────────────────
  var socket = null;
  var _handlers = {};   // eventName → [fn, fn, ...]
  var _currentRoom = '10';

  // ── Public API ───────────────────────────────────────────────────────────
  var BingoWS = {
    /** The raw socket.io socket (read-only, use the helpers below). */
    get socket() { return socket; },

    /**
     * Call once on page load.
     * @param {string} room  '10' or '20'
     */
    connect: function (room) {
      _currentRoom = String(room || '10');

      socket = io(API_BASE, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 5000,
      });

      // ── Core lifecycle ──────────────────────────────────────────────────
      socket.on('connect', function () {
        console.log('[WS] connected');
        socket.emit('join_room', { room: _currentRoom });
        _fire('connect');
      });

      socket.on('disconnect', function () {
        console.log('[WS] disconnected');
        _fire('disconnect');
      });

      // ── Game events  ────────────────────────────────────────────────────
      var GAME_EVENTS = [
        'countdown_update',
        'player_joined',
        'game_state_update',
        'game_started',
        'ball_called',
        'winner_found',
        'game_ended',
        'game_paused',
        'game_cancelled',
        'max_winners_updated',
      ];

      GAME_EVENTS.forEach(function (ev) {
        socket.on(ev, function (data) {
          // Filter events for rooms that don't match (server sends room field)
          if (data && data.room && data.room !== _currentRoom) return;
          _fire(ev, data);
        });
      });
    },

    /**
     * Switch the active room (e.g. when user picks 10 Birr vs 20 Birr).
     * @param {string} oldRoom
     * @param {string} newRoom
     */
    switchRoom: function (oldRoom, newRoom) {
      if (!socket || !socket.connected) return;
      if (oldRoom) socket.emit('leave_room', { room: String(oldRoom) });
      _currentRoom = String(newRoom);
      socket.emit('join_room', { room: _currentRoom });
    },

    /** Tell the server a player has chosen cards and is ready. */
    emitPlayerReady: function (data) {
      if (!socket) return;
      socket.emit('player_ready', Object.assign({ room: _currentRoom }, data));
    },

    /** Declare this client as a bingo winner. */
    emitDeclareWinner: function (data) {
      if (!socket) return;
      socket.emit('declare_winner', Object.assign({ room: _currentRoom }, data));
    },

    /** Request the server to start/update the countdown. */
    emitRequestCountdown: function (data) {
      if (!socket) return;
      socket.emit('request_countdown', Object.assign({ room: _currentRoom }, data));
    },

    /**
     * Register a listener for any server event (including 'connect' / 'disconnect').
     * Multiple handlers for the same event are supported.
     *
     * @param {string}   eventName
     * @param {Function} handler
     */
    on: function (eventName, handler) {
      if (!_handlers[eventName]) _handlers[eventName] = [];
      _handlers[eventName].push(handler);
    },

    /** Remove a previously registered handler. */
    off: function (eventName, handler) {
      if (!_handlers[eventName]) return;
      _handlers[eventName] = _handlers[eventName].filter(function (h) {
        return h !== handler;
      });
    },
  };

  // ── Private helper ───────────────────────────────────────────────────────
  function _fire(eventName, data) {
    var list = _handlers[eventName] || [];
    list.forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[WS] handler error for ' + eventName, e); }
    });
  }

  // Expose globally
  window.BingoWS = BingoWS;

})();
