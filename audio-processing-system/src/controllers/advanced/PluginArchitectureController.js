// src/controllers/advanced/PluginArchitectureController.js

const path = require('path');
const fs = require('fs');

class PluginArchitectureController {
  constructor(pluginDirectory = './plugins') {
    this.pluginDirectory = pluginDirectory;
    this.plugins = {};
  }

  loadPlugins() {
    const pluginFiles = fs.readdirSync(this.pluginDirectory).filter(file => file.endsWith('.js'));

    for (const file of pluginFiles) {
      const pluginPath = path.join(this.pluginDirectory, file);
      const plugin = require(pluginPath);

      if (plugin.name && plugin.init) {
        this.plugins[plugin.name] = plugin;
        plugin.init();
        console.log(`✅ Plugin loaded: ${plugin.name}`);
      }
    }
  }

  getAvailablePlugins() {
    return Object.keys(this.plugins);
  }

  invokePlugin(name, ...args) {
    if (this.plugins[name] && typeof this.plugins[name].execute === 'function') {
      return this.plugins[name].execute(...args);
    }
    throw new Error(`Plugin "${name}" not found or does not have an execute method`);
  }
}

module.exports = PluginArchitectureController;
