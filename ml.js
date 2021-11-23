"use strict";

const tf = require('@tensorflow/tfjs');
const wasm = require('@tensorflow/tfjs-backend-wasm');
const {nodeFileSystemRouter} = require('@tensorflow/tfjs-node/dist/io/file_system');

const URL = 'http://127.0.0.1:3000/model/model.json';
const SIZE  = 19;
const BATCH = 16;

const BATCH_SIZE  = 128;
const EPOCH_COUNT = 5;
const VALID_SPLIT = 0.1;

let model = null;

let timestamp = null;
let kpiTime = 0;
let kpiCount = 0;
let kpiMin = null;
let kpiMax = null;

async function initModel() {
    if (model === null) {
        await tf.enableProdMode();
        await tf.setBackend('wasm');
        tf.io.registerLoadRouter(nodeFileSystemRouter);
        tf.io.registerSaveRouter(nodeFileSystemRouter);
        model = await tf.loadLayersModel(URL);
        console.log(tf.getBackend());
    }
}

async function SaveModel(savePath) {
    await model.save(`file:///tmp/${savePath}`);
}

function kpiStart() {
    timestamp = Date.now(); 
}

function kpiStop(batch) {
    if (timestamp !== null) {
        const t = (Date.now() - timestamp) / batch;
        kpiTime += t;
        kpiCount++;
        if ((kpiMin === null) || (kpiMin > t)) kpiMin = t;
        if ((kpiMax === null) || (kpiMax < t)) kpiMax = t;
        timestamp = null;
        if ((kpiCount % 100) == 0) {
            console.log('Predict time: ' + kpiMin + ', ' + (kpiTime / kpiCount) + ', ' + kpiMax);
            kpiMin = null;
            kpiMax = null;
        }
    }
}

async function predict(board) {
    const t0 = Date.now();
    await initModel();
    const t1 = Date.now();
    console.log('Load time: ' + (t1 - t0));
    const shape = [BATCH, 1, SIZE, SIZE];
    const d = tf.tensor4d(board, shape, 'float32');
    kpiStart();
    const p = await model.predict(d);
    kpiStop(BATCH);
    const r = await p.data();
    d.dispose();
    p.dispose();
    return r;
}


async function fit(board, moves, batch) {
    const t0 = Date.now();
    await initModel();
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

module.exports.saveModel = saveModel;
module.exports.predict = predict;
module.exports.fit = fit;
