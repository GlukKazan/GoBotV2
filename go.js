"use strict";

const _ = require('underscore');
const ml = require('./ml');

const SIZE  = 19;
const BATCH = 16;

const FILTER_MIN   = 5;
const FILTER_MAX   = 10;
const FILTER_COEFF = 2;

const UNDO_TRANSFORM = [0, 1, 2, 3, 5, 4, 8, 9, 0, 1, 2, 3, 5, 4, 8, 9];

function isFriend(x) {
    return x > 0.1;
}

function isEnemy(x) {
    return x < -0.1;
}

function isEmpty(x) {
    return !isFriend(x) && !isEnemy(x);
}

function navigate(pos, dir) {
    let r = +pos + +dir;
    if (r >= SIZE * SIZE) return -1;
    if ((dir > -2) && (dir < 2)) {
        if (((pos / SIZE) | 0) != ((r / SIZE) | 0)) return -1;
    }
    return r;
}

function analyze(board) {
    let m = []; let r = []; let done = [];
    for (let p = 0; p < SIZE * SIZE; p++) {
        if (!isEmpty(board[p])) continue;
        if (_.indexOf(done, p) >= 0) continue;
        let g = [p]; let c = null; let e = [];
        for (let i = 0; i < g.length; i++) {
            m[ g[i] ] = r.length;
            done.push(g[i]);
            _.each([1, -1, SIZE, -SIZE], function(dir) {
                let q = navigate(g[i], dir);
                if (q < 0) return;
                if (_.indexOf(g, q) >= 0) return;
                if (isEnemy(board[q])) {
                    if (c === null) c = -1;
                    if (isFriend(c)) c = 0;
                    if (_.indexOf(e, q) < 0) e.push(q);
                    return;
                }
                if (isFriend(board[q])) {
                    if (c === null) c = 1;
                    if (isEnemy(c)) c = 0;
                    if (_.indexOf(e, q) < 0) e.push(q);
                    return;
                }
                g.push(q);
            });
        }
        r.push({
            type:  0,
            group: g,
            color: c,
            edge:  e
        });
    }
    for (let p = 0; p < SIZE * SIZE; p++) {
        if (_.indexOf(done, p) >= 0) continue;
        let f = isFriend(board[p]);
        let g = [p]; let d = []; let y = []; let e = [];
        for (let i = 0; i < g.length; i++) {
            m[ g[i] ] = r.length;
            done.push(g[i]);
            _.each([1, -1, SIZE, -SIZE], function(dir) {
                let q = navigate(g[i], dir);
                if (q < 0) return;
                if (_.indexOf(g, q) >= 0) return;
                if (isFriend(board[q])) {
                    if (!f) {
                        if (_.indexOf(e, q) < 0) e.push(q);
                        return;
                    } else {
                        if (_.indexOf(g, q) < 0) g.push(q);
                    }
                } else if (isEnemy(board[q])) {
                    if (f) {
                        if (_.indexOf(e, q) < 0) e.push(q);
                        return;
                    } else {
                        if (_.indexOf(g, q) < 0) g.push(q);
                    }
                } else {
                    if (_.indexOf(d, q) < 0) d.push(q);
                    let ix = m[q];
                    if (_.isUndefined(ix)) return;
                    if (!isEmpty(r[ix].type)) return;
                    if (f) {
                        if (isFriend(r[ix].color)) {
                            if (_.indexOf(y, q) < 0) y.push(q);
                            r[ix].isEye = true;
                        }
                    } else {
                        if (isEnemy(r[ix].color)) {
                            if (_.indexOf(y, q) < 0) y.push(q);
                            r[ix].isEye = true;
                        }
                    }
                }
            });
        }
        r.push({
            type:  f ? 1 : -1,
            group: g,
            dame:  d,
            eyes:  y,
            edge:  e
        });
    }
    return {
        map: m,
        res: r
    }
}

function UndoMove(board, undo) {
    if (undo.length > 0) {
        const u = undo.pop();
        board[u.pos] = u.data;
    }
}

function RedoMove(board, move, ko, undo, stat) {
    let captured = []; let f = true;
    _.each([1, -1, SIZE, -SIZE], function(dir) {
        let p = navigate(move, dir);
        if (p < 0) return;
        let ix = stat.map[p];
        if (_.isUndefined(ix)) return;
        if (!isEnemy(stat.res[ix].type)) {
            f = false;
            return;
        }
        if (stat.res[ix].dame.length > 1) return;
        _.each(stat.res[ix].group, function (q) {
            undo.push({
                pos: q,
                data: board[q]
            });
            board[q] = 0;
            captured.push(q);
        });
    });
    if (captured.length == 1 && f) {
        ko.push(captured[0]);
    }
    undo.push({
        pos: move,
        data: board[move]
    });
    board[move] = 1;
    return board;
}

function GetFen(board, ko, move) {
    let r = "";
    for (let row = 0; row < SIZE; row++) {
        if (row != 0) r += '/';
        let empty = 0;
        for (let col = 0; col < SIZE; col++) {
            const pos = row * SIZE + col;
            if (_.indexOf(ko, pos) >= 0) {
                r += 'X';
                continue;
            }
            const piece = board[pos];
            if (isEmpty(piece)) {
                if (empty > 8) {
                    r += empty;
                    empty = 0;
                }
                empty++;
            }
            else {
                if (empty != 0) 
                    r += empty;
                empty = 0;
                if (isFriend(piece)) {
                    r += (move == pos) ? 'B' : 'b';
                } else {
                    r += (move == pos) ? 'W' : 'w';
                }
            }
        }
        if (empty != 0) {
            r += empty;
        }
    }
    return r;
}

function ApplyMove(board, move) {
    let ko = [];
    const stat = analyze(board);
    let b = RedoMove(board, move, ko, [], stat);
    return GetFen(b, ko, move);
}

function flipX(pos) {
    const x = pos % SIZE;
    pos -= x;
    return pos + (SIZE - x - 1);
}

function flipY(pos) {
    const y = (pos / SIZE) | 0;
    pos -= y * SIZE;
    return (SIZE - y - 1) * SIZE + pos;
}

function toRight(pos) {
    const x = pos % SIZE;
    const y = (pos / SIZE) | 0;
    return x * SIZE + (SIZE - y - 1);
}

function toLeft(pos) {
    const x = pos % SIZE;
    const y = (pos / SIZE) | 0;
    return (SIZE - x - 1) * SIZE + y;
}

function transform(pos, n) {    
    switch (n) {
        case 1:
            pos = flipX(pos);
            break;
        case 2:
            pos = flipY(pos);
            break;
        case 3:
            pos = flipX(pos);
            pos = flipY(pos);
            break;
        case 4:
            pos = toRight(pos);
            break;
        case 5:
            pos = toLeft(pos);
            break;
        case 6:
            pos = toRight(pos);
            pos = flipX(pos);
            break;
        case 7:
            pos = toLeft(pos);
            pos = flipX(pos);
            break;
        case 8:
            pos = flipX(pos);
            pos = toLeft(pos);
            break;
        case 9:
            pos = flipX(pos);
            pos = toRight(pos);
            break;
    }
    return pos;
}

function InitializeFromFen(board, fen, offset, batch) {
    let row = 0; let col = 0; let ko = null;
    for (let i = 0; i < fen.length; i++) {
         let c = fen.charAt(i);
         if (c == '/') {
             row++;
             col = 0;
             continue;
         }
         if (c >= '0' && c <= '9') {
             col += parseInt(c);
             continue;
         }
         let piece = 0;
         const pos = row * SIZE + col;
         switch (c) {
            case 'W': 
               piece = 1;
               break;
            case 'w': 
               piece = 1;
               break;
            case 'B': 
               piece = -1;
               break;
            case 'b': 
               piece = -1;
               break;
            case 'X':
               piece = 0;
               ko = pos;
               break;
        }
        let o = offset;
        for (let ix = 0; ix < 8; ix++, o += SIZE * SIZE) {
            const p = transform(pos, ix) + o;
            board[p] = piece;
            if (batch == 1) break;
        }
        for (let ix = 0; ix < 8; ix++, o += SIZE * SIZE) {
            if (batch == 1) break;
            const p = transform(pos, ix) + o;
            board[p] = -piece;
        }
        col++;
    }
    return ko;
}

function checkForbidden(board, ko) {
    let r = [];
    for (let p = 0; p < SIZE * SIZE; p++) {
        if (!isEmpty(board[p])) r.push(p);
    }
    if (ko !== null) {
        r.push(ko);
    }
    const a = analyze(board);

    return r;
}

function extractMoves(data, batch, forbidden) {
    let r = [];
    let o = 0;
    for (let ix = 0; ix < batch; ix++, o += SIZE * SIZE) {
        for (let pos = 0; pos < SIZE * SIZE; pos++) {
            const w = data[pos + o] * data[pos + o] * data[pos + o];
            const p = transform(pos, UNDO_TRANSFORM[ix]);
            if (_.indexOf(forbidden, p) >= 0) continue;
            r.push({
                pos: p,
                weight: (ix >= 8) ? -w : w
            });
        }
    }
    return r;
}

function filterMoves(moves, logger, mn, mx, coeff) {
    const m = _.sortBy(moves, function(x) {
        return -Math.abs(x.weight);
    });
    let sz = m.length; let ix = 0;
    if (sz < 1) return; sz = 1;
    while (sz < Math.min(m.length - 1, mn)) {
        if (Math.abs(m[sz].weight) * coeff < Math.abs(m[sz - 1].weight)) break;
        if (sz >= mx) break;
        sz++;
    }
    let r = [];
    for (let i = 0; i < sz; i++) {
        console.log(FormatMove(m[i].pos) + ': ' + m[i].weight);
        logger(FormatMove(m[i].pos) + ': ' + m[i].weight);
        r.push(m[i]);
    }
    return r;
}

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

function FormatMove(move) {
    if (move === null) return "Pass";
    const col = move % SIZE;
    const row = (move / SIZE) | 0;
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's'];
    return letters[col] + (SIZE - row);
}

async function FindMove(fen, callback, logger) {
    const t1 = Date.now();
    let board = new Float32Array(BATCH * SIZE * SIZE);
    const ko = InitializeFromFen(board, fen, 0, BATCH);
    const forbidden = checkForbidden(board, ko);
    const result = await ml.Predict(board);
    const moves = filterMoves(extractMoves(result, BATCH, forbidden), logger, FILTER_MIN, FILTER_MAX, FILTER_COEFF);
    const m = randomChoose(moves);
    const t2 = Date.now();
    if (m !== null) {
        const f = ApplyMove(board, m.pos);
        callback(m.pos, f, Math.abs(m.weight) * 1000, t2 - t1);
    } else {
        callback(null, f, 0, t2 - t1);
    }
}

async function Advisor(sid, fen, coeff, callback) {
    const t1 = Date.now();
    let board = new Float32Array(BATCH * SIZE * SIZE);
    const ko = InitializeFromFen(board, fen, 0, BATCH);
    const forbidden = checkForbidden(board, ko);
    const result = await ml.Predict(board);
    const moves = filterMoves(extractMoves(result, BATCH, forbidden), logger, FILTER_MIN, FILTER_MAX, coeff);
    const t2 = Date.now();
    const r = _.map(moves, function(m) {
        return {
            sid: sid,
            move: FormatMove(m.pos),
            weight: m.weight * 1000
        };
    });
    callback(result, t2 - t1);
}

module.exports.FormatMove = FormatMove;
module.exports.FindMove = FindMove;
module.exports.Advisor = Advisor;
