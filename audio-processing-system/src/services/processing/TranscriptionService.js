// src/services/processing/TranscriptionService.js
const { Configuration, OpenAIApi } = require('openai');

class TranscriptionService {
  constructor(apiKey) {
    this.openai = new OpenAIApi(new Configuration({ apiKey }));
  }

  async transcribe(audioBuffer, format = 'mp3') {
    const response = await this.openai.createTranscription(
      audioBuffer, 
      'whisper-1',
      undefined,
      format
    );
    return response?.data?.text || '';
  }
}

module.exports = TranscriptionService;