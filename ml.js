"use strict";

const tf = require('@tensorflow/tfjs');

const URL   = 'https://games.dtco.ru/test/model.json';
const SIZE  = 19;
const BATCH = 16;

const BATCH_SIZE  = 128;
const EPOCH_COUNT = 5;
const VALID_SPLIT = 0.1;

let model = null;

async function InitModel() {
    if (model === null) {
        model = await tf.loadLayersModel(URL);
        console.log(tf.getBackend());
    }
}

async function SaveModel(savePath) {

}

async function Predict(board) {
    const t0 = Date.now();
    await InitModel();
    const t1 = Date.now();
    console.log('Load time: ' + (t1 - t0));
    const shape = [BATCH, 1, SIZE, SIZE];
    const d = tf.tensor4d(board, shape, 'float32');
    const p = await model.predict(d);
    const r = await p.data();
    const t2 = Date.now();
    console.log('Predict time: ' + (t2 - t1));
    d.dispose();
    p.dispose();
    return r;
}


async function Fit(board, moves, batch) {
    const t0 = Date.now();
    await InitModel();
    const t1 = Date.now();
    console.log('Load time: ' + (t1 - t0));
    const xshape = [batch, 1, SIZE, SIZE];
    const xs = tf.tensor4d(board, xshape, 'float32');
    const yshape = [batch, SIZE * SIZE];
    const ys =  tf.tensor2d(moves, yshape, 'float32');
    model.compile({optimizer: 'sgd', loss: 'categoricalCrossentropy', metrics: ['accuracy']});
    const h = await model.fit(xs, ys, {
        batchSize: BATCH_SIZE,
        epochs: EPOCH_COUNT,
        validationSplit: VALID_SPLIT
    });    
    const t2 = Date.now();
    const delta = t2 - t1;
    console.log('Fit time: ' + delta);
    xs.dispose();
    ys.dispose();
    return h;
}

module.exports.SaveModel = SaveModel;
module.exports.Predict = Predict;
module.exports.Fit = Fit;
