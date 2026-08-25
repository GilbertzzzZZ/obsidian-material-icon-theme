import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { Window } from 'happy-dom';

const SVG = {
  file: '<svg xmlns="http://www.w3.org/2000/svg" data-icon="file"></svg>',
  typescript: '<svg xmlns="http://www.w3.org/2000/svg" data-icon="typescript"></svg>',
  folder: '<svg xmlns="http://www.w3.org/2000/svg" data-icon="folder"></svg>',
  folderOpen: '<svg xmlns="http://www.w3.org/2000/svg" data-icon="folder-open"></svg>',
};

const bundle = await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [
    {
      name: 'test-stubs',
      setup(builder) {
        builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'test-stub' }));
        builder.onResolve({ filter: /^\.\/icon-data$/ }, () => ({ path: 'icon-data', namespace: 'test-stub' }));

        builder.onLoad({ filter: /^obsidian$/, namespace: 'test-stub' }, () => ({
          contents: `
            export class Plugin {}
            export class Modal {}
            export class Notice {}
            export class PluginSettingTab {}
            export class Setting {}
            export class WorkspaceLeaf {}
            export function getLanguage() { return 'en'; }
          `,
          loader: 'js',
        }));

        builder.onLoad({ filter: /^icon-data$/, namespace: 'test-stub' }, () => ({
          contents: `
            export const iconRegistry = ${JSON.stringify({
              file: { dark: SVG.file, light: SVG.file },
              typescript: { dark: SVG.typescript, light: SVG.typescript },
              folder: { dark: SVG.folder, light: SVG.folder },
              'folder-open': { dark: SVG.folderOpen, light: SVG.folderOpen },
            })};
            export const fileExtensionKeys = { ts: 'typescript' };
            export const fileNameKeys = {};
            export const folderNameKeys = {};
            export const folderNameOpenKeys = {};
            export const defaultFileIconKey = 'file';
            export const folderIconKey = 'folder';
            export const folderOpenIconKey = 'folder-open';
          `,
          loader: 'js',
        }));
      },
    },
  ],
});

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.Document = window.Document;
globalThis.DOMParser = window.DOMParser;
globalThis.HTMLElement = window.HTMLElement;
globalThis.MutationObserver = window.MutationObserver;

Object.defineProperties(window.HTMLElement.prototype, {
  createSpan: {
    value(options = {}) {
      const span = this.ownerDocument.createElement('span');
      if (options.cls) span.className = options.cls;
      this.appendChild(span);
      return span;
    },
  },
  empty: {
    value() {
      this.replaceChildren();
    },
  },
  instanceOf: {
    value(type) {
      return this instanceof type;
    },
  },
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { default: MaterialFileIconsPlugin } = await import(moduleUrl);

function createPlugin() {
  const plugin = Object.create(MaterialFileIconsPlugin.prototype);
  plugin.settings = {
    applyToFiles: true,
    applyToFolders: true,
    enableCustomRules: false,
    customRules: [],
    language: 'auto',
  };
  plugin.containers = new Map();
  plugin.folderObservers = new Map();
  plugin.refreshTimer = null;
  plugin.refreshDeadline = null;
  plugin.isDark = false;
  return plugin;
}

function createFileRow(path) {
  const item = document.createElement('div');
  item.className = 'tree-item nav-file';

  const title = document.createElement('div');
  title.className = 'tree-item-self nav-file-title';
  title.dataset.path = path;

  const content = document.createElement('div');
  content.className = 'nav-file-title-content';
  title.appendChild(content);
  item.appendChild(title);

  return { item, title };
}

function createFolderRow(path) {
  const item = document.createElement('div');
  item.className = 'tree-item nav-folder is-collapsed';

  const title = document.createElement('div');
  title.className = 'tree-item-self nav-folder-title';
  title.dataset.path = path;

  const content = document.createElement('div');
  content.className = 'nav-folder-title-content';
  title.appendChild(content);
  item.appendChild(title);

  const children = document.createElement('div');
  children.className = 'tree-item-children';
  item.appendChild(children);

  return { item, title };
}

async function flushMutations() {
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}

test.afterEach(() => {
  document.body.replaceChildren();
});

test.after(async () => {
  await window.happyDOM.close();
});

test('recycled rows keep the same icon host while data-path changes', async () => {
  const plugin = createPlugin();
  const container = document.createElement('div');
  const { item, title } = createFileRow('before.md');
  container.appendChild(item);
  document.body.appendChild(container);

  plugin.injectFileIcon(title, title.dataset.path);
  const iconBefore = title.querySelector('.mfi-icon');
  let scheduledRefreshes = 0;
  plugin.scheduleRefresh = () => { scheduledRefreshes += 1; };
  const observer = plugin.observeContainer(container);

  title.dataset.path = 'after.ts';
  await flushMutations();

  assert.equal(title.querySelector('.mfi-icon') === iconBefore, true);
  assert.equal(title.querySelector('svg')?.dataset.icon, 'typescript');
  assert.equal(title.getAttribute('data-mfi-applied'), '1');
  assert.equal(scheduledRefreshes, 0);
  observer.disconnect();
});

test('new tree items receive icons without scheduling a whole-tree refresh', async () => {
  const plugin = createPlugin();
  const container = document.createElement('div');
  document.body.appendChild(container);

  let scheduledRefreshes = 0;
  plugin.scheduleRefresh = () => { scheduledRefreshes += 1; };
  const observer = plugin.observeContainer(container);
  const { item, title } = createFileRow('new.ts');
  const attachedSubtree = document.createElement('div');
  attachedSubtree.appendChild(item);

  container.appendChild(attachedSubtree);
  await flushMutations();

  assert.equal(title.querySelector('svg')?.dataset.icon, 'typescript');
  assert.equal(title.getAttribute('data-mfi-applied'), '1');
  assert.equal(scheduledRefreshes, 0);
  observer.disconnect();
});

test('expanding a folder updates its SVG without scheduling a refresh', async () => {
  const plugin = createPlugin();
  const { item, title } = createFolderRow('src');
  document.body.appendChild(item);

  plugin.processItem(item);
  const iconBefore = title.querySelector('.mfi-icon');
  let scheduledRefreshes = 0;
  plugin.scheduleRefresh = () => { scheduledRefreshes += 1; };

  item.classList.remove('is-collapsed');
  await flushMutations();

  assert.equal(title.querySelector('.mfi-icon') === iconBefore, true);
  assert.equal(title.querySelector('svg')?.dataset.icon, 'folder-open');
  assert.equal(scheduledRefreshes, 0);
});
