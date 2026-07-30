#!/usr/bin/env node
/**
 * Expo CLI's DevTools plugin discovery calls
 * `scanExpoModuleResolutionsForPlatform(..., 'devtools')`, which hangs forever
 * on this repo (native tree crawl). Patch `@expo/cli` so `expo start` can bind.
 *
 * Idempotent — safe to run from gustrarun / postinstall.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.join(
  root,
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/DevToolsPluginManager.js'
);

const MARKER = 'EXPO_NO_DEVTOOLS_PLUGINS';

const PATCHED = `    async queryPluginsAsync() {
        // Gustra: \`scanExpoModuleResolutionsForPlatform(..., 'devtools')\` never
        // resolves on this project (hangs while crawling native trees). Skip so
        // \`expo start\` can bind Metro. DevTools plugin websockets stay unavailable.
        if (process.env.EXPO_NO_DEVTOOLS_PLUGINS !== '0') {
            this.plugins = this.plugins ?? [];
            return this.plugins;
        }
        if (!this.plugins) {
            this.plugins = await this.queryAutolinkedPluginsAsync(this.projectRoot);
            event('dev-tools-plugin:load', {
                plugins: this.plugins.map((plugin)=>({
                        packageName: plugin.packageName,
                        bannerTitle: plugin.bannerTitle,
                        cliBanner: plugin.cliBanner,
                        webpageEndpoint: plugin.webpageEndpoint
                    }))
            });
        }
        return this.plugins;
    }`;

const ORIGINAL = `    async queryPluginsAsync() {
        if (!this.plugins) {
            this.plugins = await this.queryAutolinkedPluginsAsync(this.projectRoot);
            event('dev-tools-plugin:load', {
                plugins: this.plugins.map((plugin)=>({
                        packageName: plugin.packageName,
                        bannerTitle: plugin.bannerTitle,
                        cliBanner: plugin.cliBanner,
                        webpageEndpoint: plugin.webpageEndpoint
                    }))
            });
        }
        return this.plugins;
    }`;

function main() {
  if (!fs.existsSync(target)) {
    console.warn(`› patch-expo-devtools-hang: missing ${path.relative(root, target)}`);
    return;
  }
  const text = fs.readFileSync(target, 'utf8');
  if (text.includes(MARKER)) {
    console.log('› Expo DevTools hang patch already applied');
    return;
  }
  if (!text.includes(ORIGINAL)) {
    console.warn('› patch-expo-devtools-hang: unexpected DevToolsPluginManager.js — skip');
    return;
  }
  fs.writeFileSync(target, text.replace(ORIGINAL, PATCHED));
  console.log('› Applied Expo DevTools hang patch');
}

main();
