const { Menu, shell, BrowserWindow, app, dialog } = require('electron');
const prompt = require('electron-prompt');
const path = require('path');
const fs = require('fs');
const electronLog = require('electron-log');
// Export app info
const appName = app.getName();
var appVersion = app.getVersion();
const userDataDir = app.getPath('userData');
const userLogFile = path.join(userDataDir, 'logs/main.log');

module.exports = (store, services, mainWindow, app, defaultUserAgent) => {
  var servicesMenuItems = [];
  var defaultServiceMenuItems = [];
  var enabledServicesMenuItems = [];
  let examplePlaceholder;

  // Globally export what OS we are on
  const isLinux = process.platform === 'linux';
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  // Enable remote module on sub-windows
  require("@electron/remote/main").enable(mainWindow.webContents);

  if (services !== undefined) {
    // Menu with all services that can be clicked for easy switching
    servicesMenuItems = services.map(service => ({
      label: service.name,
      visible: !service.hidden,
      click() {
        electronLog.info('Loading URL: ' + service.url);
        mainWindow.loadURL(service.url);
        mainWindow.send('run-loader', service);
      }
    }));

    // Menu for selecting default service (one which is opened on starting the app)
    defaultServiceMenuItems = services.map(service => ({
      label: service.name,
      type: 'checkbox',
      checked: store.get('options.defaultService')
          ? store.get('options.defaultService') == service.name
          : false,
      click(e) {
        e.menu.items.forEach(e => {
          if (!(e.label === service.name)) e.checked = false;
        });
        store.set('options.defaultService', service.name);
      }
    }));

    // Menu with all services that can be clicked for easy switching
    enabledServicesMenuItems = services.map(service => ({
      label: service.name,
      type: 'checkbox',
      checked: !service.hidden,
      click() {
        if(service._defaultService) {
          let currServices = store.get('services');
          currServices.push({
            name: service.name,
            hidden: !service.hidden
          });
          services = currServices;
          store.set('services', currServices);
        } else {
          let currServices = store.get('services');
          let currService = currServices.find(s => service.name == s.name);
          currService.hidden = service.hidden ? undefined : true
          services = currServices;
          store.set('services', currServices);
        }
        app.emit('relaunch');
      }
    }));
  }

  return Menu.buildFromTemplate([
    {
      label: appName,
      submenu: [
        {
          label: 'Main Menu',
          accelerator: 'CmdOrCtrl+M',
          click() {
            electronLog.info('Opening main menu...');
            mainWindow.webContents.userAgent = defaultUserAgent;
            mainWindow.loadFile('./ui/index.html');
          }
        },
        {
          label: 'Go Back',
          accelerator: 'Alt+Left',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.goBack();
            var currentURL = focusedWindow.webContents.getURL();
            electronLog.info('Navigated backward to ' + [ currentURL ]);
          }
        },
        {
          label: 'Go Forward',
          accelerator: 'Alt+Right',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.goForward();
            var currentURL = focusedWindow.webContents.getURL();
            electronLog.info('Navigated forward to ' + [ currentURL ]);
          }
        },
        { type: 'separator' },
        { label: 'Open File',
          accelerator: 'Ctrl+Shift+O',
          click() {
            dialog.showOpenDialog({ properties: ['openFile'] }).then(result => {
            electronLog.info('Opened file:' + result.filePaths);
            var openURI = result.filePaths
            const openWindow = new BrowserWindow({
              webPreferences: {
                nodeIntegration: false,
                nodeIntegrationInWorker: false,
                contextIsolation: false,
                sandbox: true,
                experimentalFeatures: true,
                webviewTag: true,
                devTools: true,
                javascript: true,
                plugins: true,
                enableRemoteModule: true,
              },
            });
            openWindow.loadFile(openURI[0]);
            openWindow.setTitle(openURI[0])});
          }
        },
        {
          label: 'Open Custom URL',
          accelerator: 'CmdOrCtrl+O',
          click(item, focusedWindow) {
            if (store.get('options.customOmitHttps')) {
              examplePlaceholder = 'https://example.org';
            } else {
              examplePlaceholder = 'example.org';
            }
            prompt({
              title: 'Open Custom URL',
              label: 'URL:',
              alwaysOnTop: true,
              showWhenReady: true,
              resizable: true,
              menuBarVisible: true,
              inputAttrs: {
                  placeholder: examplePlaceholder
              }
          })
          .then(inputtedURL => {
            if (inputtedURL != null) {
              if(inputtedURL == '') {
                if (store.get('options.customOmitHttps')) {
                  inputtedURL = 'https://example.org';
                } else {
                  inputtedURL = 'example.org';
                }
              }
              if (store.get('options.customOmitHttps')) {
                electronLog.info('Opening Custom URL: ' + inputtedURL);
              } else {
                electronLog.info('Opening Custom URL: ' + 'https://' + inputtedURL);
              }
              if (store.get('options.customOmitHttps')) {
                focusedWindow.loadURL(inputtedURL);
              } else {
                focusedWindow.loadURL('https://' + inputtedURL);
              }
            }
          })
          .catch(console.error);
          }
        },
        { type: 'separator' },
        {
          label: 'Shortcut Table',
          accelerator: 'CmdorCtrl+Alt+H',
          click() {
            const helpWindow = new BrowserWindow({
              width: 632,
              height: 600,
              useContentSize: true,
              title: "Quark Player Help",
              icon: isWin ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'icon64.png'),
              webPreferences: {
                nodeIntegration: false,
                nodeIntegrationInWorker: false,
                contextIsolation: false,
                sandbox: false,
                experimentalFeatures: true,
                webviewTag: true,
                devTools: true,
                javascript: true,
                plugins: true,
                enableRemoteModule: true,
                preload: path.join(__dirname, 'client-preload.js'),
              },
            });
            require("@electron/remote/main").enable(helpWindow.webContents);
            helpWindow.loadFile('./ui/help.html');
            electronLog.info('Opened help.html');
          }
        },
        {
          label: 'About Quark Player',
          accelerator: 'Cmd+Alt+A',
          acceleratorWorksWhenHidden: false,
          visible: isMac ? true : false,
          click() {
            const aboutWindow = new BrowserWindow({
              width: 512,
              height: 480,
              useContentSize: true,
              title: "About Quark Player",
              icon: isWin ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'icon64.png'),
              webPreferences: {
                nodeIntegration: false,
                nodeIntegrationInWorker: false,
                contextIsolation: false,
                sandbox: false,
                experimentalFeatures: true,
                webviewTag: true,
                devTools: true,
                javascript: true,
                plugins: true,
                enableRemoteModule: true,
                preload: path.join(__dirname, 'client-preload.js'),
              },
            });
            require("@electron/remote/main").enable(aboutWindow.webContents);
            aboutWindow.loadFile('./ui/about.html');
            electronLog.info('Opened about.html');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit Quark Player',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit'
        },
      ]
    },
    {
      label: 'Services',
      submenu: [
        {
          label: 'Main Menu',
          accelerator: 'CmdOrCtrl+M',
          click() {
            electronLog.info('Opening main menu...');
            mainWindow.webContents.userAgent = defaultUserAgent;
            mainWindow.loadFile('./ui/index.html');
          }
        },
        {
          label: 'Open Custom URL',
          accelerator: 'CmdOrCtrl+O',
          click(item, focusedWindow) {
            if (store.get('options.customOmitHttps')) {
              examplePlaceholder = 'https://example.org';
            } else {
              examplePlaceholder = 'example.org';
            }
            prompt({
              title: 'Open Custom URL',
              label: 'URL:',
              alwaysOnTop: true,
              showWhenReady: true,
              resizable: true,
              menuBarVisible: true,
              inputAttrs: {
                  placeholder: examplePlaceholder
              }
          })
          .then(inputtedURL => {
            if (inputtedURL != null) {
              if(inputtedURL == '') {
                if (store.get('options.customOmitHttps')) {
                  inputtedURL = 'https://example.org';
                } else {
                  inputtedURL = 'example.org';
                }
              }
              if (store.get('options.customOmitHttps')) {
                electronLog.info('Opening Custom URL: ' + inputtedURL);
              } else {
                electronLog.info('Opening Custom URL: ' + 'https://' + inputtedURL);
              }
              if (store.get('options.customOmitHttps')) {
                focusedWindow.loadURL(inputtedURL);
              } else {
                focusedWindow.loadURL('https://' + inputtedURL);
              }
            }
          })
          .catch(console.error);
          }
        },
        { type: 'separator' },
        {
          label: 'Enable/Disable Services *',
          submenu: enabledServicesMenuItems
        },
        { type: 'separator' }
      ].concat(servicesMenuItems)
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Enable AdBlocker *',
          type: 'checkbox',
          click(e) {
            store.set('options.adblock', e.checked);

            // Store details to remeber when relaunched
            if (mainWindow.getURL() != '') {
              store.set('relaunch.toPage', mainWindow.getURL());
            }
            store.set('relaunch.windowDetails', {
              position: mainWindow.getPosition(),
              size: mainWindow.getSize()
            });

            app.emit('relaunch-confirm');
          },
          checked: store.get('options.adblock')
            ? store.get('options.adblock')
            : false
        },
        {
          label: 'Default Service',
          submenu: [
            {
              label: 'Menu',
              type: 'checkbox',
              click(e) {
                e.menu.items.forEach(e => {
                  if (!(e.label === 'Menu')) e.checked = false;
                });
                store.delete('options.defaultService');
              },
              checked: store.get('options.defaultService') === undefined
            },
            {
              label: 'Last Opened Page',
              type: 'checkbox',
              click(e) {
                e.menu.items.forEach(e => {
                  if (!(e.label === 'Last Opened Page')) e.checked = false;
                });
                store.set('options.defaultService', 'lastOpenedPage');
              },
              checked: store.get('options.defaultService') === 'lastOpenedPage'
            },
            { type: 'separator' }
          ].concat(defaultServiceMenuItems)
        },
        {
          label: 'Omit https:// from Custom URL',
          type: 'checkbox',
          click() {
            if (store.get('options.customOmitHttps')) {
              store.set('options.customOmitHttps', false);
            } else {
              store.set('options.customOmitHttps', true);
            }
          },
          checked: store.get('options.customOmitHttps')
        },
        {
          label: store.get('options.useLightMode') ? 'Use Dark Mode' : 'Use Light Mode',
          type: 'checkbox',
          accelerator: 'CmdorCtrl+Shift+D',
          click() {
            if (store.get('options.useLightMode')) {
              store.set('options.useLightMode', false);
            } else {
              store.set('options.useLightMode', true);
            }
            app.emit('relaunch-confirm');
          },
          checked: false
        },
        {
          label: 'Always On Top',
          type: 'checkbox',
          click(e) {
            store.set('options.alwaysOnTop', e.checked);
            mainWindow.setAlwaysOnTop(e.checked);
          },
          checked: store.get('options.alwaysOnTop')
        },
        {
          label: 'Frameless Window *',
          type: 'checkbox',
          accelerator: 'CmdorCtrl+Alt+F',
          click(e) {
            store.set('options.hideWindowFrame', e.checked);
            app.emit('relaunch-confirm');
          },
          checked: store.get('options.hideWindowFrame')
            ? store.get('options.hideWindowFrame')
            : false
        },
        {
          label: 'Remember Window Details',
          type: 'checkbox',
          click() {
            if (store.get('options.windowDetails')) {
              store.delete('options.windowDetails');
            } else {
              store.set('options.windowDetails', {});
            }
          },
          checked: !!store.get('options.windowDetails')
        },
        {
          label: 'Picture In Picture *',
          type: 'checkbox',
          visible: isMac || isLinux || isWin,
          click(e) {
            store.set('options.pictureInPicture', e.checked);
            app.emit('relaunch-confirm');
          },
          checked: store.get('options.pictureInPicture')
            ? store.get('options.pictureInPicture')
            : false
        },
        {
          label: 'Start in Fullscreen',
          type: 'checkbox',
          click(e) {
            store.set('options.launchFullscreen', e.checked);
          },
          checked: store.get('options.launchFullscreen')
            ? store.get('options.launchFullscreen')
            : false
        },
        {
          label: 'Reset all Settings *',
          click() {
            // Reset Config
            store.clear();

            // Clear Engine Cache
            let engineCachePath = path.join(userDataDir, 'adblock-engine-cache.txt');
            fs.access(engineCachePath, fs.constants.F_OK, (err) => {
              if (!err) {
                fs.unlinkSync(engineCachePath);
              }
            });

            app.emit('reset-confirm');
          }
        },
        { label: '* Requires an App Restart', enabled: false }
      ]
    },
    {
      role: 'editMenu',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      role: 'viewMenu',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.reloadIgnoringCache();
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click(item, focusedWindow) {
            var currentURL = focusedWindow.webContents.getURL();
            electronLog.info('Toggling Developer Tools on ' + currentURL);
            focusedWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'windowMenu',
      submenu: [
        {
          label: 'Go Back',
          accelerator: 'Alt+Left',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.goBack();
            var currentURL = focusedWindow.webContents.getURL();
            electronLog.info('Navigated backward to ' + [ currentURL ]);
          }
        },
        {
          label: 'Go Forward',
          accelerator: 'Alt+Right',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.goForward();
            var currentURL = focusedWindow.webContents.getURL();
            electronLog.info('Navigated forward to ' + [ currentURL ]);
          }
        },
        {
          label: 'New Window',
          accelerator: 'CmdorCtrl+N',
          click() {
            app.emit('new-window');
          }
        },
        {
          label: 'Minimize Window',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.minimize();
            electronLog.info('Minimized a window');
          }
        },
        {
          label: 'Close Window',
          accelerator: 'CmdorCtrl+W',
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.close();
            electronLog.info('Closed a Window');
          }
        }
      ]
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Reload F5',
          accelerator:  'F5',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click(item, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.reload();
          }
        },
        {
          label: 'Open Log File',
          click() {
            electronLog.info('Opening ' + [ userLogFile ]);
            const logWindow = new BrowserWindow({width: 600, height: 768, useContentSize: true, title: userLogFile});
            logWindow.loadFile(userLogFile);
          }
        },
        {
          label: 'Edit Config File',
          click() {
            store.openInEditor();
            electronLog.info('Editing Config File');
            if (isLinux) {
              return;
            } else {
              console.log('\n Note that JSON must be a recognized file type \n for the OS to open the config.json file.\n');
            }
          }
        },
        {
          label: 'Open User Data Dir',
          click() {
            electronLog.info('Opening ' + [ userDataDir ]);
            shell.openPath(userDataDir);
          }
        },
        { type: 'separator' },
        {
          label: 'Open Electron DevTools',
          accelerator: isMac ? 'Cmd+Shift+F12' : 'F12',
          click(item, focusedWindow) {
            electronLog.info('Opening Electron DevTools on mainWindow.');
            focusedWindow.openDevTools({ mode: 'detach' });
          }
        },
        {
          label: 'Open Electron DevTools Extra',
          accelerator: 'Ctrl+Shift+F12',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click(item, focusedWindow) {
            electronLog.info('Opening Electron DevTools on mainWindow.');
            focusedWindow.openDevTools({ mode: 'detach' });
          }
        },
        {
          label: 'Open chrome://gpu',
          accelerator: 'CmdorCtrl+Alt+G',
          click() {
            const gpuWindow = new BrowserWindow({width: 900, height: 700, useContentSize: true, title: "GPU Internals"});
            gpuWindow.loadURL('chrome://gpu');
            electronLog.info('Opened chrome://gpu');
          }
        },
        {
          label: 'Open chrome://process-internals',
          accelerator: 'CmdorCtrl+Alt+P',
          click() {
            const procsWindow = new BrowserWindow({width: 900, height: 700, useContentSize: true, title: "Process Model Internals"});
            procsWindow.loadURL('chrome://process-internals');
            electronLog.info('Opened chrome://process-internals');
          }
        },
        {
          label: 'Open chrome://media-internals',
          accelerator: 'CmdorCtrl+Alt+M',
          click() {
            const mediaWindow = new BrowserWindow({width: 900, height: 700, useContentSize: true, title: "Media Internals"});
            mediaWindow.loadURL('chrome://media-internals');
            electronLog.info('Opened chrome://media-internals');
          }
        },
        {
          label: 'Open Test Image',
          visible: process.env.QUARK_TEST === '1',
          accelerator: 'CmdorCtrl+Alt+Shift+T',
          acceleratorWorksWhenHidden: false,
          click() {
            const yiffWindow = new BrowserWindow({width: 600, height: 818, useContentSize: true, title: "Catgirl Fridge"});
            electronLog.info('Opening test image')
            //yiffWindow.loadFile('./ui/imgs/juno-ass.png');
            yiffWindow.loadFile('./ui/yiff.html');
          }
        },
        {
          label: 'Disable Acceleration',
          type: 'checkbox',
          click() {
            if (store.get('options.disableAcceleration')) {
              store.set('options.disableAcceleration', false);
            } else {
              store.set('options.disableAcceleration', true);
            }
            app.emit('restart-confirm');
          },
          checked: store.get('options.disableAcceleration')
        },
        {
          label: 'Enable Vulkan',
          type: 'checkbox',
          click() {
            if (store.get('options.enableVulkan')) {
              store.set('options.enableVulkan', false);
            } else {
              store.set('options.enableVulkan', true);
            }
            app.emit('restart-confirm');
          },
          checked: store.get('options.enableVulkan')
        },
        {
          label: 'Restart App',
          click() {
            app.emit('restart-confirm');
          }
        }
      ]
    },
    {
      role: 'help',
      label: 'About',
      submenu: [
        { label: appName + ' v' + appVersion, enabled: false },
        { label: 'Created by Oscar Beaumont &&',
          click() {
            //shell.openExternal(
              //'https://github.com/oscartbeaumont/ElectronPlayer#readme'
            //);
            //electronLog.info('Opened external browser');
            new BrowserWindow({width: 1024, height: 768, useContentSize: true}).loadURL('https://github.com/oscartbeaumont/ElectronPlayer#readme');
          }
        },
        { label: 'Maintained by Alex313031',
          click() {
            //shell.openExternal(
              //'https://github.com/Alex313031/quarkplayer#readme'
            //);
            //electronLog.info('Opened external browser');
            new BrowserWindow({width: 1024, height: 768, useContentSize: true}).loadURL('https://github.com/Alex313031/quark-player#readme');
          }
        },
        { type: 'separator' },
        {
          label: 'View Humans.txt',
          accelerator: 'CmdorCtrl+Alt+Shift+H',
          click() {
            const humansWindow = new BrowserWindow({width: 532, height: 600, useContentSize: true, title: "humans.txt"});
            humansWindow.loadFile('./ui/humans.txt');
            electronLog.info('Opened humans.txt :)');
          }
        },
        {
          label: 'View License',
          accelerator: 'CmdorCtrl+Alt+Shift+L',
          click() {
            const licenseWindow = new BrowserWindow({width: 532, height: 550, useContentSize: true, title: "License"});
            licenseWindow.loadFile('./ui/license.md');
            electronLog.info('Opened license.md');
          }
        },
        {
          label: 'About App',
          accelerator: 'CmdorCtrl+Alt+A',
          click() {
            const aboutWindow = new BrowserWindow({
              width: 512,
              height: 500,
              useContentSize: true,
              title: "About Quark Player",
              icon: isWin ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'icon64.png'),
              webPreferences: {
                nodeIntegration: false,
                nodeIntegrationInWorker: false,
                contextIsolation: false,
                sandbox: false,
                experimentalFeatures: true,
                webviewTag: true,
                devTools: true,
                javascript: true,
                plugins: true,
                enableRemoteModule: true,
                preload: path.join(__dirname, 'client-preload.js'),
              },
            });
            require("@electron/remote/main").enable(aboutWindow.webContents);
            aboutWindow.loadFile('./ui/about.html');
            electronLog.info('Opened about.html');
          }
        }
      ]
    }
  ]);
};
