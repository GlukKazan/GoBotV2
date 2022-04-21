"use strict";

const _ = require('underscore');
const go = require('./go');
const ml = require('./ml');

const SIZE            = 19;
const BATCH           = 16;
const CURRENT_PLAYER  = 1;

const DEFAULT_TIMEOUT = 10000;
const MCTS_COUNT      = 1000;
const UCT_COEFF       = 1.41;

const FILTER_MIN      = 5;
const FILTER_MAX      = 10;
const FILTER_COEFF    = 2;

function norm(moves) {
    if (moves.length > 0) {
        let s = 0;
        _.each(moves, function(m) {
            s += m.weight;
        });
        _.each(moves, function(m) {
            m.weight = m.weight / s;
        });
    }
    return moves;
}

function createNodes(moves) {
    return _.map(norm(moves), function(move) {
        return {
            pos: move.pos,
            weight: move.weight,
            cnt: 0,
            win: 0
        };
    });
}

function uctChoose(nodes, cnt) {
    return _.max(nodes, function(x) {
        return UCT_COEFF * x.win * Math.sqrt(cnt) / (1 + x.cnt) + x.weight;
    });
}

function maxChoose(nodes, cnt) {
    return _.max(nodes, function(x) {
        return x.cnt;
    });
}

function randomChoose(moves) {
    let r = null;
    const sz = moves.length;
    if (sz > 0) {
        let ix = 0;
        if (sz > 1) {
            ix = _.random(0, sz - 1);
        }
        r = moves[ix];
    }
    return r;
}

function weighedChoose(moves) {
    let ix = -1; let sm = 0;
    const lm = _.random(0, 999);
    for (let i = 0; i < moves.length; i++) {
        ix++;
        sm += moves[i].weight * 1000;
        if (sm >= lm) break;
    }
    if (ix < 0) return null;
    return moves[ix];
}

async function simulate(board, move, undo) {
    // TODO:

}

function estimate(board, player) {
    // TODO:

}

function undoMoves(board, undo) {
    while (undo.length > 0) {
        const u = undo.pop();
        board[u.pos] = u.data;
    }
}

async function findMove(fen, callback, logger, timeout) {
    if (_.isUndefined(timeout)) {
        timeout = DEFAULT_TIMEOUT;
    }
    const t1 = Date.now();
    let board = new Float32Array(BATCH * SIZE * SIZE);
    const ko = go.initializeFromFen(board, fen, BATCH);
    const result = await ml.predict(board);
    const forbidden = go.checkForbidden(board, ko);
    const stat = go.analyze(board, CURRENT_PLAYER);
    const hints = go.getHints(board, CURRENT_PLAYER, stat);
    const raw = go.extractMoves(result, BATCH, forbidden, hints);
    const moves = go.filterMoves(raw, logger, FILTER_MIN, FILTER_MAX, FILTER_COEFF);
    let nodes = createNodes(moves);
    let cnt = 0;
    let undo = [];
    for (let i = 0; i < MCTS_COUNT; i++) {
        const node = uctChoose(nodes, cnt);
        await simulate(board, node.pos, undo);
        if (estimate(board, CURRENT_PLAYER) > 0) {
            node.win++;
        }
        node.cnt++;
        cnt++;
        undoMoves(board, undo);
        var t2 = Date.now();
        if (t2 - t1 > timeout) break;
    }
    const m = maxChoose(nodes);
    if (m !== null) {
        const fen = go.applyMove(board, m.pos);
        callback(m.pos, f, Math.abs(m.weight) * 1000, t2 - t1);
    } else {
        // Pass move
        callback(null, f, 0, t2 - t1);
    }
}

async function advisor(sid, fen, coeff, callback, logger) {
    const t1 = Date.now();
    let board = new Float32Array(BATCH * SIZE * SIZE);
    const ko = go.initializeFromFen(board, fen, BATCH);
    const forbidden = go.checkForbidden(board, ko);
    const result = await ml.predict(board);
    const raw = go.extractMoves(result, BATCH, forbidden);
    const moves = go.filterMoves(raw, logger, FILTER_MIN, FILTER_MAX, coeff);
    const t2 = Date.now();
    const r = _.map(moves, function(m) {
        return {
            sid: sid,
            move: go.formatMove(m.pos),
            weight: m.weight * 1000
        };
    });
    callback(r, t2 - t1);
}

module.exports.findMove = findMove;
module.exports.advisor = advisor;
