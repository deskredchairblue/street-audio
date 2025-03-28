/**
 * @route POST /api/projects
 * @description Create a new project
 * @access Public
 */
router.post('/', async (req, res, next) => {
    const operationId = logger.startTimer('create-project');
    
    try {
      const { name, ownerId, settings, tracks, tags } = req.body;
      
      if (!name) {
        logger.stopTimer(operationId, { error: 'Project name is required' });
        return res.status(400).json({ error: 'Project name is required' });
      }
      
      if (!ownerId) {
        logger.stopTimer(operationId, { error: 'Owner ID is required' });
        return res.status(400).json({ error: 'Owner ID is required' });
      }
      
      // Create new project
      const project = new AudioProject({
        name,
        ownerId,
        settings: settings || {}
      });
      
      // Add tracks if provided
      if (tracks && Array.isArray(tracks)) {
        const trackStorage = new Map(); // This would be imported from a shared module
        
        for (const trackId of tracks) {
          const track = trackStorage.get(trackId);
          if (track) {
            project.addTrack(track);
          }
        }
      }
      
      // Add tags if provided
      if (tags && Array.isArray(tags)) {
        project.tags = tags;
      }
      
      // Store project
      projectStorage.set(project.id, project);
      
      logger.stopTimer(operationId, { 
        projectId: project.id,
        trackCount: project.tracks.length
      });
      
      res.status(201).json({ project });
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route GET /api/projects/:id
   * @description Get project by ID
   * @access Public
   */
  router.get('/:id', async (req, res, next) => {
    const { id } = req.params;
    const operationId = logger.startTimer('get-project', { projectId: id });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.query;
      if (!project.settings.isPublic && 
          project.ownerId !== userId && 
          !project.collaborators.some(c => c.userId === userId)) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized access to project' });
      }
      
      logger.stopTimer(operationId);
      res.json({ project });
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route PUT /api/projects/:id
   * @description Update project details
   * @access Public
   */
  router.put('/:id', async (req, res, next) => {
    const { id } = req.params;
    const operationId = logger.startTimer('update-project', { projectId: id });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.body;
      if (project.ownerId !== userId && 
          !project.collaborators.some(c => c.userId === userId && c.role === 'editor')) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized to update project' });
      }
      
      // Update project fields
      const { name, settings, tags } = req.body;
      
      if (name) {
        project.name = name;
      }
      
      if (settings) {
        project.settings = { ...project.settings, ...settings };
      }
      
      if (tags) {
        project.tags = tags;
      }
      
      // Update metadata
      project.metadata.updatedAt = new Date();
      
      logger.stopTimer(operationId);
      res.json({ project });
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route DELETE /api/projects/:id
   * @description Delete a project
   * @access Public
   */
  router.delete('/:id', async (req, res, next) => {
    const { id } = req.params;
    const operationId = logger.startTimer('delete-project', { projectId: id });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.query;
      if (project.ownerId !== userId) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Only the owner can delete a project' });
      }
      
      // Remove from storage
      projectStorage.delete(id);
      
      logger.stopTimer(operationId);
      res.status(204).end();
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route POST /api/projects/:id/tracks
   * @description Add tracks to a project
   * @access Public
   */
  router.post('/:id/tracks', async (req, res, next) => {
    const { id } = req.params;
    const operationId = logger.startTimer('add-project-tracks', { projectId: id });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.body;
      if (project.ownerId !== userId && 
          !project.collaborators.some(c => c.userId === userId && c.role === 'editor')) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized to modify project' });
      }
      
      // Add tracks
      const { trackIds } = req.body;
      
      if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
        logger.stopTimer(operationId, { error: 'Track IDs are required' });
        return res.status(400).json({ error: 'Track IDs are required' });
      }
      
      const trackStorage = new Map(); // This would be imported from a shared module
      const addedTracks = [];
      
      for (const trackId of trackIds) {
        const track = trackStorage.get(trackId);
        if (track) {
          project.addTrack(track);
          addedTracks.push({
            id: track.id,
            title: track.title,
            duration: track.duration
          });
        }
      }
      
      // Update metadata
      project.metadata.updatedAt = new Date();
      
      logger.stopTimer(operationId, { 
        tracksAdded: addedTracks.length 
      });
      
      res.json({ 
        project: {
          id: project.id,
          trackCount: project.tracks.length,
          addedTracks
        } 
      });
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route DELETE /api/projects/:id/tracks/:trackId
   * @description Remove a track from a project
   * @access Public
   */
  router.delete('/:id/tracks/:trackId', async (req, res, next) => {
    const { id, trackId } = req.params;
    const operationId = logger.startTimer('remove-project-track', { 
      projectId: id,
      trackId
    });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.query;
      if (project.ownerId !== userId && 
          !project.collaborators.some(c => c.userId === userId && c.role === 'editor')) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized to modify project' });
      }
      
      // Remove track
      const removed = project.removeTrack(trackId);
      
      if (!removed) {
        logger.stopTimer(operationId, { error: 'Track not found in project' });
        return res.status(404).json({ error: 'Track not found in project' });
      }
      
      // Update metadata
      project.metadata.updatedAt = new Date();
      
      logger.stopTimer(operationId);
      res.status(204).end();
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route POST /api/projects/:id/collaborators
   * @description Add collaborators to a project
   * @access Public
   */
  router.post('/:id/collaborators', async (req, res, next) => {
    const { id } = req.params;
    const operationId = logger.startTimer('add-collaborators', { projectId: id });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { requesterId } = req.body;
      if (project.ownerId !== requesterId) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Only the owner can add collaborators' });
      }
      
      // Add collaborators
      const { collaborators } = req.body;
      
      if (!collaborators || !Array.isArray(collaborators) || collaborators.length === 0) {
        logger.stopTimer(operationId, { error: 'Collaborators are required' });
        return res.status(400).json({ error: 'Collaborators are required' });
      }
      
      const addedCollaborators = [];
      
      for (const { userId, role } of collaborators) {
        if (!userId) continue;
        
        project.addCollaborator({ 
          userId, 
          role: role || 'viewer' 
        });
        
        addedCollaborators.push({ userId, role });
      }
      
      // Update metadata
      project.metadata.updatedAt = new Date();
      
      logger.stopTimer(operationId, { 
        collaboratorsAdded: addedCollaborators.length 
      });
      
      res.json({ 
        project: {
          id: project.id,
          name: project.name,
          collaborators: project.collaborators
        } 
      });
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route DELETE /api/projects/:id/collaborators/:userId
   * @description Remove a collaborator from a project
   * @access Public
   */
  router.delete('/:id/collaborators/:userId', async (req, res, next) => {
    const { id, userId } = req.params;
    const operationId = logger.startTimer('remove-collaborator', { 
      projectId: id,
      userId
    });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { requesterId } = req.query;
      if (project.ownerId !== requesterId && requesterId !== userId) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized to remove collaborator' });
      }
      
      // Remove collaborator
      project.removeCollaborator(userId);
      
      // Update metadata
      project.metadata.updatedAt = new Date();
      
      logger.stopTimer(operationId);
      res.status(204).end();
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route POST /api/projects/:id/markers
   * @description Add a marker to a project
   * @access Public
   */
  router.post('/:id/markers', async (req, res, next) => {
    const { id } = req.params;
    const operationId = logger.startTimer('add-marker', { projectId: id });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.body;
      if (project.ownerId !== userId && 
          !project.collaborators.some(c => c.userId === userId && c.role === 'editor')) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized to modify project' });
      }
      
      // Add marker
      const { time, label, color } = req.body;
      
      if (time === undefined || time < 0) {
        logger.stopTimer(operationId, { error: 'Valid time is required' });
        return res.status(400).json({ error: 'Valid time is required' });
      }
      
      if (!label) {
        logger.stopTimer(operationId, { error: 'Marker label is required' });
        return res.status(400).json({ error: 'Marker label is required' });
      }
      
      const markerId = project.addMarker({ time, label, color });
      
      // Update metadata
      project.metadata.updatedAt = new Date();
      
      logger.stopTimer(operationId, { markerId });
      
      res.status(201).json({ 
        marker: {
          id: markerId,
          time,
          label,
          color
        } 
      });
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route DELETE /api/projects/:id/markers/:markerId
   * @description Remove a marker from a project
   * @access Public
   */
  router.delete('/:id/markers/:markerId', async (req, res, next) => {
    const { id, markerId } = req.params;
    const operationId = logger.startTimer('remove-marker', { 
      projectId: id,
      markerId
    });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.query;
      if (project.ownerId !== userId && 
          !project.collaborators.some(c => c.userId === userId && c.role === 'editor')) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized to modify project' });
      }
      
      // Remove marker
      const removed = project.removeMarker(markerId);
      
      if (!removed) {
        logger.stopTimer(operationId, { error: 'Marker not found' });
        return res.status(404).json({ error: 'Marker not found' });
      }
      
      // Update metadata
      project.metadata.updatedAt = new Date();
      
      logger.stopTimer(operationId);
      res.status(204).end();
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  /**
   * @route GET /api/projects/:id/export
   * @description Export project data
   * @access Public
   */
  router.get('/:id/export', async (req, res, next) => {
    const { id } = req.params;
    const operationId = logger.startTimer('export-project', { projectId: id });
    
    try {
      const project = projectStorage.get(id);
      
      if (!project) {
        logger.stopTimer(operationId, { error: 'Project not found' });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check authorization
      const { userId } = req.query;
      if (!project.settings.isPublic && 
          project.ownerId !== userId && 
          !project.collaborators.some(c => c.userId === userId)) {
        logger.stopTimer(operationId, { error: 'Unauthorized access' });
        return res.status(403).json({ error: 'Unauthorized access to project' });
      }
      
      // Format project for export
      const exportData = {
        id: project.id,
        name: project.name,
        owner: project.ownerId,
        settings: project.settings,
        tracks: project.tracks.map(track => ({
          id: track.id,
          title: track.title,
          duration: track.duration,
          path: track.path
        })),
        markers: project.markers,
        collaborators: project.collaborators,
        metadata: {
          version: "1.0",
          exportedAt: new Date(),
          originalCreatedAt: project.metadata.createdAt
        }
      };
      
      logger.stopTimer(operationId);
      res.json(exportData);
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      next(error);
    }
  });
  
  module.exports = router;