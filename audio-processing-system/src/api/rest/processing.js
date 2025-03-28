/**
 * @module api/rest/processing
 * @description REST API endpoints for audio processing operations
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AudioProcessingService = require('../../services/processing/AudioProcessingService');
const NeuralProcessingService = require('../../services/processing/NeuralProcessingService');
const DistributedProcessingModel = require('../../models/advanced/DistributedProcessingModel');
const WorkerThreadPool = require('../../utils/performance/WorkerThreadPool');
const logger = require('../../utils/helpers/AudioLogger');

const router = express.Router();
const audioProcessor = new AudioProcessingService();
const neuralProcessor = new NeuralProcessingService();

// In-memory job storage (would be replaced with database in production)
const processingJobs = new Map();

// Initialize worker thread pool for processing
const workerPool = new WorkerThreadPool({
  minThreads: parseInt(process.env.MIN_WORKER_THREADS) || 2,
  maxThreads: parseInt(process.env.MAX_WORKER_THREADS) || 4
});

/**
 * @route POST /api/processing/effects
 * @description Apply audio effects to a track
 * @access Public
 */
router.post('/effects', async (req, res, next) => {
  const operationId = logger.startTimer('apply-effects');
  
  try {
    const { trackId, effects, outputFormat } = req.body;
    
    if (!trackId) {
      logger.stopTimer(operationId, { error: 'Track ID is required' });
      return res.status(400).json({ error: 'Track ID is required' });
    }
    
    if (!effects || !Array.isArray(effects) || effects.length === 0) {
      logger.stopTimer(operationId, { error: 'At least one effect is required' });
      return res.status(400).json({ error: 'At least one effect is required' });
    }
    
    // Get track from storage
    const trackStorage = new Map(); // This would be imported from a shared module
    const track = trackStorage.get(trackId);
    
    if (!track) {
      logger.stopTimer(operationId, { error: 'Track not found' });
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Create processing job
    const jobId = uuidv4();
    const processingJob = {
      id: jobId,
      type: 'effects',
      status: 'created',
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: {
        trackId,
        effects,
        outputFormat: outputFormat || track.format
      },
      progress: 0,
      result: null,
      error: null
    };
    
    // Store job
    processingJobs.set(jobId, processingJob);
    
    // Start processing in background
    processEffectsJob(processingJob).catch(error => {
      logger.error('Error processing effects job', { jobId, error: error.message });
      processingJob.status = 'failed';
      processingJob.error = error.message;
      processingJob.updatedAt = new Date();
    });
    
    logger.stopTimer(operationId, { jobId });
    
    // Return job details
    res.status(202).json({ 
      job: {
        id: jobId,
        type: processingJob.type,
        status: processingJob.status,
        createdAt: processingJob.createdAt
      }
    });
  } catch (error) {
    logger.stopTimer(operationId, { error: error.message });
    next(error);
  }
});

/**
 * Process effects job asynchronously
 * 
 * @param {Object} job - Processing job
 * @returns {Promise<void>}
 */
async function processEffectsJob(job) {
  try {
    // Update job status
    job.status = 'processing';
    job.updatedAt = new Date();
    
    // Get track
    const trackStorage = new Map(); // This would be imported from a shared module
    const track = trackStorage.get(job.parameters.trackId);
    
    // Process effects
    const result = await audioProcessor.applyEffects(track, job.parameters.effects, {
      outputFormat: job.parameters.outputFormat,
      onProgress: progress => {
        job.progress = progress;
        job.updatedAt = new Date();
      }
    });
    
    // Update job with result
    job.status = 'completed';
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date();
    
    logger.info('Effects processing completed', { 
      jobId: job.id, 
      duration: Date.now() - job.createdAt.getTime() 
    });
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.updatedAt = new Date();
    
    logger.error('Effects processing failed', { 
      jobId: job.id, 
      error: error.message 
    });
    
    throw error;
  }
}

/**
 * @route POST /api/processing/neural
 * @description Apply neural processing to a track
 * @access Public
 */
router.post('/neural', async (req, res, next) => {
  const operationId = logger.startTimer('neural-processing');
  
  try {
    const { trackId, modelType, parameters } = req.body;
    
    if (!trackId) {
      logger.stopTimer(operationId, { error: 'Track ID is required' });
      return res.status(400).json({ error: 'Track ID is required' });
    }
    
    if (!modelType) {
      logger.stopTimer(operationId, { error: 'Model type is required' });
      return res.status(400).json({ error: 'Model type is required' });
    }
    
    // Get track from storage
    const trackStorage = new Map(); // This would be imported from a shared module
    const track = trackStorage.get(trackId);
    
    if (!track) {
      logger.stopTimer(operationId, { error: 'Track not found' });
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Create processing job
    const jobId = uuidv4();
    const processingJob = {
      id: jobId,
      type: 'neural',
      status: 'created',
      createdAt: new Date(),
      updatedAt: new Date(),
      parameters: {
        trackId,
        modelType,
        parameters: parameters || {}
      },
      progress: 0,
      result: null,
      error: null
    };
    
    // Store job
    processingJobs.set(jobId, processingJob);
    
    // Start processing in background
    processNeuralJob(processingJob).catch(error => {
      logger.error('Error processing neural job', { jobId, error: error.message });
      processingJob.status = 'failed';
      processingJob.error = error.message;
      processingJob.updatedAt = new Date();
    });
    
    logger.stopTimer(operationId, { jobId, modelType });
    
    // Return job details
    res.status(202).json({ 
      job: {
        id: jobId,
        type: processingJob.type,
        status: processingJob.status,
        createdAt: processingJob.createdAt
      }
    });
  } catch (error) {
    logger.stopTimer(operationId, { error: error.message });
    next(error);
  }
});

/**
 * Process neural job asynchronously
 * 
 * @param {Object} job - Processing job
 * @returns {Promise<void>}
 */
async function processNeuralJob(job) {
  try {
    // Update job status
    job.status = 'processing';
    job.updatedAt = new Date();
    
    // Get track
    const trackStorage = new Map(); // This would be imported from a shared module
    const track = trackStorage.get(job.parameters.trackId);
    
    // Process with neural model
    const result = await neuralProcessor.processAudio(track, job.parameters.modelType, {
      ...job.parameters.parameters,
      onProgress: progress => {
        job.progress = progress;
        job.updatedAt = new Date();
      }
    });
    
    // Update job with result
    job.status = 'completed';
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date();
    
    logger.info('Neural processing completed', { 
      jobId: job.id, 
      modelType: job.parameters.modelType,
      duration: Date.now() - job.createdAt.getTime() 
    });
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.updatedAt = new Date();
    
    logger.error('Neural processing failed', { 
      jobId: job.id, 
      modelType: job.parameters.modelType,
      error: error.message 
    });
    
    throw error;
  }
}

/**
 * @route POST /api/processing/distributed
 * @description Process audio with distributed processing
 * @access Public
 */
router.post('/distributed', async (req, res, next) => {
  const operationId = logger.startTimer('distributed-processing');
  
  try {
    const { trackId, operations, distributionStrategy } = req.body;
    
    if (!trackId) {
      logger.stopTimer(operationId, { error: 'Track ID is required' });
      return res.status(400).json({ error: 'Track ID is required' });
    }
    
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      logger.stopTimer(operationId, { error: 'Operations are required' });
      return res.status(400).json({ error: 'Operations are required' });
    }
    
    // Get track from storage
    const trackStorage = new Map(); // This would be imported from a shared module
    const track = trackStorage.get(trackId);
    
    if (!track) {
      logger.stopTimer(operationId, { error: 'Track not found' });
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Create distributed processing model
    const distributedModel = new DistributedProcessingModel({
      processingType: 'batch',
      taskDefinition: {
        inputFormat: track.format,
        outputFormat: track.format,
        operations
      },
      distributionStrategy: distributionStrategy || { type: 'chunk' }
    });
    
    // Create work units
    await distributedModel.createWorkUnits({
      duration: track.duration,
      sampleRate: track.sampleRate,
      channels: track.channels,
      fileSize: track.metadata.fileSize || 0
    });
    
    // Store the model
    processingJobs.set(distributedModel.jobId, distributedModel);
    
    // Start processing
    distributedModel.start();
    
    // Process work units with worker thread pool
    processDistributedJob(distributedModel).catch(error => {
      logger.error('Error in distributed processing', { 
        jobId: distributedModel.jobId, 
        error: error.message 
      });
      
      distributedModel.fail(error);
    });
    
    logger.stopTimer(operationId, { 
      jobId: distributedModel.jobId,
      strategy: distributedModel.distributionStrategy.type
    });
    
    // Return job details
    res.status(202).json({ 
      job: {
        id: distributedModel.jobId,
        type: 'distributed',
        status: distributedModel.executionState.status,
        workUnits: distributedModel.workUnits.length,
        createdAt: distributedModel.metadata.createdAt
      }
    });
  } catch (error) {
    logger.stopTimer(operationId, { error: error.message });
    next(error);
  }
});

/**
 * Process distributed job with worker thread pool
 * 
 * @param {DistributedProcessingModel} model - Distributed processing model
 * @returns {Promise<void>}
 */
async function processDistributedJob(model) {
  try {
    // Get available work units
    const pendingUnits = model.getWorkUnitsByStatus('pending');
    
    // Process work units concurrently with worker pool
    const promises = pendingUnits.map(unit => {
      return workerPool.submitTask({
        type: 'processWorkUnit',
        unitId: unit.id,
        operations: unit.operations,
        parameters: unit.parameters
      }, unit.priority === 'high' ? 1 : 0)
      .then(result => {
        // Update work unit with result
        model.updateWorkUnit(unit.id, {
          status: 'completed',
          progress: 100,
          result
        });
        
        return result;
      })
      .catch(error => {
        // Update work unit with error
        model.updateWorkUnit(unit.id, {
          status: 'failed',
          error: error.message
        });
        
        throw error;
      });
    });
    
    // Wait for all work units to complete
    await Promise.all(promises);
    
    // Complete the job
    model.complete({
      outputLocations: ['output/path/to/processed/file.wav'], // Example
      metrics: {
        processingTime: (Date.now() - model.executionState.startTime) / 1000,
        nodeConcurrency: model.executionState.activeNodes.length
      }
    });
    
    logger.info('Distributed processing completed', { 
      jobId: model.jobId, 
      unitsProcessed: model.executionState.completedUnits,
      duration: Date.now() - model.metadata.createdAt.getTime()
    });
  } catch (error) {
    model.fail(error);
    
    logger.error('Distributed processing failed', { 
      jobId: model.jobId, 
      error: error.message 
    });
    
    throw error;
  }
}

/**
 * @route GET /api/processing/jobs/:id
 * @description Get processing job status
 * @access Public
 */
router.get('/jobs/:id', async (req, res, next) => {
  const { id } = req.params;
  const operationId = logger.startTimer('get-job-status', { jobId: id });
  
  try {
    const job = processingJobs.get(id);
    
    if (!job) {
      logger.stopTimer(operationId, { error: 'Job not found' });
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Generate response based on job type
    let response;
    
    if (job instanceof DistributedProcessingModel) {
      // Distributed processing job
      response = {
        id: job.jobId,
        type: 'distributed',
        status: job.executionState.status,
        progress: job.executionState.progress,
        createdAt: job.metadata.createdAt,
        updatedAt: job.metadata.updatedAt,
        completedUnits: job.executionState.completedUnits,
        totalUnits: job.executionState.totalUnits,
        activeNodes: job.executionState.activeNodes.length,
        result: job.executionState.status === 'completed' ? job.results : null,
        error: job.results.errors.length > 0 ? job.results.errors[0].message : null
      };
    } else {
      // Regular processing job
      response = {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        result: job.result,
        error: job.error
      };
    }
    
    logger.stopTimer(operationId, { status: response.status });
    res.json({ job: response });
  } catch (error) {
    logger.stopTimer(operationId, { error: error.message });
    next(error);
  }
});

/**
 * @route DELETE /api/processing/jobs/:id
 * @description Cancel a processing job
 * @access Public
 */
router.delete('/jobs/:id', async (req, res, next) => {
  const { id } = req.params;
  const operationId = logger.startTimer('cancel-job', { jobId: id });
  
  try {
    const job = processingJobs.get(id);
    
    if (!job) {
      logger.stopTimer(operationId, { error: 'Job not found' });
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Cancel job based on type
    if (job instanceof DistributedProcessingModel) {
      // Distributed processing job
      job.cancel();
    } else {
      // Regular processing job
      job.status = 'cancelled';
      job.updatedAt = new Date();
    }
    
    logger.stopTimer(operationId);
    res.status(204).end();
  } catch (error) {
    logger.stopTimer(operationId, { error: error.message });
    next(error);
  }
});

module.exports = router;