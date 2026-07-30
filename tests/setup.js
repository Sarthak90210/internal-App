const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const Module = require('module');

// Global mock state for Firestore and Auth
const firestoreStore = new Map(); // key: path string, value: object data
let mockDocMissing = false; // flag to simulate missing doc error
let mockClaims = {};
let mockCurrentUser = {
  email: 'test@teamrotor.com',
  getIdToken: async () => 'mock-id-token-123',
  getIdTokenResult: async () => ({ claims: mockClaims })
};

// Mock fetch globally
global.fetchCalls = [];
global.fetch = async (url, options = {}) => {
  global.fetchCalls.push({ url, options });
  if (url.includes('/api/upload')) {
    return {
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' })
    };
  }
  if (url.includes('/api/admins')) {
    return {
      ok: true,
      json: async () => ({ admins: [{ email: 'admin@teamrotor.com', isRoot: false, isSuperAdmin: true }] })
    };
  }
  return {
    ok: true,
    json: async () => ({ ok: true })
  };
};

global.FormData = class FormData {
  constructor() {
    this._data = [];
  }
  append(key, value) {
    this._data.push({ key, value });
  }
};

const React = require('react');

// Enable React 19 Hook Dispatcher in Node test environment
const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
if (internals) {
  internals.H = {
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: (cb) => { if (cb) cb(); },
    useMemo: (cb) => cb(),
    useCallback: (cb) => cb,
    useRef: (initial) => ({ current: initial }),
    useContext: (ctx) => (ctx && ctx._currentValue) || {},
    useLayoutEffect: (cb) => { if (cb) cb(); },
    useId: () => 'mock-id',
    useReducer: (reducer, initial) => [initial, () => {}],
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
    useDebugValue: () => {},
    useDeferredValue: (v) => v,
    useTransition: () => [false, (cb) => cb && cb()],
    useImperativeHandle: (ref, fn) => { if (ref) ref.current = fn(); },
    useInsertionEffect: (cb) => { if (cb) cb(); },
  };
}

const mockComponent = (name) => {
  const Component = (props) => {
    return { type: name, props, children: props.children };
  };
  Component.displayName = name;
  return Component;
};

// Built-in module overrides using Module._load
const originalLoad = Module._load;

const mockAuth = {
  currentUser: mockCurrentUser,
  onAuthStateChanged: (cb) => {
    mockAuth._onAuthStateChangedCb = cb;
    cb(mockAuth.currentUser);
    return () => {};
  }
};

const mockModules = {
  'react-native-safe-area-context': {
    SafeAreaProvider: mockComponent('SafeAreaProvider'),
    SafeAreaView: mockComponent('SafeAreaView'),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  },
  'react-native-screens': {
    enableScreens: () => {},
    ScreenContainer: mockComponent('ScreenContainer'),
    Screen: mockComponent('Screen'),
  },
  '@react-native-google-signin/google-signin': {
    GoogleSignin: {
      configure: () => {},
      hasPlayServices: async () => true,
      signIn: async () => ({ data: { idToken: 'mock-google-id-token' } }),
      signOut: async () => {},
    },
    GoogleSigninButton: mockComponent('GoogleSigninButton'),
    statusCodes: { SIGN_IN_CANCELLED: 'CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'NOT_AVAILABLE' }
  },
  'expo-file-system': {
    documentDirectory: 'file:///mock-documents/',
    cacheDirectory: 'file:///mock-cache/',
    writeAsStringAsync: async () => {},
    readAsStringAsync: async () => '',
    deleteAsync: async () => {},
    StorageAccessFramework: {
      requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: 'file:///mock-dir' }),
      createFileAsync: async () => 'file:///mock-file',
    },
    // New SDK 54 filesystem API.
    Paths: { cache: 'file:///mock-cache', document: 'file:///mock-documents' },
    File: class File {
      constructor(dir, name) { this.uri = `${dir}/${name}`; this.exists = false; this._content = ''; }
      create() { this.exists = true; }
      write(content) { this._content = content; this.exists = true; }
      delete() { this.exists = false; }
    },
    Directory: class Directory {},
  },
  'expo-sharing': {
    isAvailableAsync: async () => true,
    shareAsync: async () => {},
  },
  'expo-camera': {
    Camera: mockComponent('Camera'),
    CameraView: mockComponent('CameraView'),
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, async () => ({ granted: true }), async () => ({ granted: true })],
    getCameraPermissionsAsync: async () => ({ granted: true }),
    requestCameraPermissionsAsync: async () => ({ granted: true }),
  },
  'expo-image-picker': {
    launchImageLibraryAsync: async () => ({ canceled: true }),
    launchCameraAsync: async () => ({ canceled: true }),
  },
  'expo-av': {
    Video: mockComponent('Video'),
    Audio: { Sound: class Sound {} }
  },
  'expo-symbols': {
    SymbolView: mockComponent('SymbolView')
  },
  'react-native-reanimated': {
    __esModule: true,
    default: {
      createAnimatedComponent: (c) => c,
      View: mockComponent('Animated.View'),
      Text: mockComponent('Animated.Text'),
      ScrollView: mockComponent('Animated.ScrollView'),
      Image: mockComponent('Animated.Image'),
    },
    createAnimatedComponent: (c) => c,
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withSpring: (v) => v,
    withTiming: (v) => v,
    withSequence: (v) => v,
    withRepeat: (v) => v,
    withDelay: (v) => v,
    Easing: { linear: (v) => v, ease: (v) => v, out: (v) => v, in: (v) => v, inOut: (v) => v, bezier: () => ((v) => v) },
    FadeIn: { duration: () => ({ delay: () => {} }) },
    FadeOut: { duration: () => ({ delay: () => {} }) },
    SlideInRight: { duration: () => {} },
    SlideOutRight: { duration: () => {} },
  },
  'react-native-gesture-handler': {
    GestureHandlerRootView: mockComponent('GestureHandlerRootView'),
  },
  '@react-native-async-storage/async-storage': {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    clear: async () => {},
  },
  'react-native': {
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    Pressable: mockComponent('Pressable'),
    Modal: mockComponent('Modal'),
    ScrollView: mockComponent('ScrollView'),
    FlatList: mockComponent('FlatList'),
    SectionList: mockComponent('SectionList'),
    ActivityIndicator: mockComponent('ActivityIndicator'),
    SegmentedButtons: mockComponent('SegmentedButtons'),
    Checkbox: mockComponent('Checkbox'),
    Badge: mockComponent('Badge'),
    Portal: mockComponent('Portal'),
    Dialog: mockComponent('Dialog'),
    TextInput: mockComponent('TextInput'),
    Button: mockComponent('Button'),
    IconButton: mockComponent('IconButton'),
    Menu: mockComponent('Menu'),
    Touchable: { Mixin: {} },
    Platform: { OS: 'ios', select: (obj) => obj.ios || obj.default },
    Dimensions: { get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }) },
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
    PixelRatio: { get: () => 2, getFontScale: () => 1, roundToNearestPixel: (n) => n },
    StatusBar: { ...mockComponent('StatusBar'), currentHeight: 24, setBarStyle: () => {}, setBackgroundColor: () => {} },
    Keyboard: { addListener: () => ({ remove: () => {} }), dismiss: () => {} },
    Linking: { openURL: async () => {}, canOpenURL: async () => true, addEventListener: () => ({ remove: () => {} }) },
    Easing: { linear: () => {}, ease: () => {}, bezier: () => {}, inOut: (fn) => fn },
    Image: { ...mockComponent('Image'), resolveAssetSource: () => ({ uri: '' }), getSize: (uri, success) => success(100, 100) },
    ImageBackground: mockComponent('ImageBackground'),
    RefreshControl: mockComponent('RefreshControl'),
    Switch: mockComponent('Switch'),
    Animated: {
      View: mockComponent('Animated.View'),
      Text: mockComponent('Animated.Text'),
      createAnimatedComponent: (c) => c,
      timing: () => ({ start: (cb) => cb && cb() }),
      spring: () => ({ start: (cb) => cb && cb() }),
      Value: class { constructor(v) { this.value = v; } setValue(v) { this.value = v; } interpolate() { return 0; } }
    },
    Alert: {
      alert: (title, message) => {
        global.lastAlert = { title, message };
      }
    },
    StyleSheet: {
      create: (styles) => styles
    }
  },
  'react-native-svg': {
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    Path: mockComponent('Path'),
    Circle: mockComponent('Circle'),
    Rect: mockComponent('Rect'),
    G: mockComponent('G'),
    Line: mockComponent('Line'),
    Polygon: mockComponent('Polygon'),
    Polyline: mockComponent('Polyline'),
  },
  'react-native-paper': {
    useTheme: () => ({
      colors: {
        primary: '#1e88e5',
        background: '#121212',
        surface: '#1e1e1e',
        onSurface: '#ffffff',
        surfaceVariant: '#2c2c2c',
        error: '#cf6679',
        onSurfaceDisabled: '#666666'
      }
    }),
    MD3DarkTheme: {
      colors: {
        primary: '#1e88e5',
        background: '#121212',
        surface: '#1e1e1e',
        onSurface: '#ffffff',
        surfaceVariant: '#2c2c2c',
        error: '#cf6679',
        onSurfaceDisabled: '#666666',
        elevation: { level1: '#1e1e1e', level2: '#242424', level3: '#2a2a2a' }
      }
    },
    MD3LightTheme: { colors: {} },
    configureFonts: () => ({}),
    Provider: mockComponent('Provider'),
    Searchbar: mockComponent('Searchbar'),
    FAB: mockComponent('FAB'),
    List: {
      Item: mockComponent('List.Item'),
      Icon: mockComponent('List.Icon'),
      Accordion: mockComponent('List.Accordion'),
    },
    Text: mockComponent('Text'),
    ActivityIndicator: mockComponent('ActivityIndicator'),
    SegmentedButtons: mockComponent('SegmentedButtons'),
    Checkbox: mockComponent('Checkbox'),
    Badge: mockComponent('Badge'),
    Portal: mockComponent('Portal'),
    Dialog: mockComponent('Dialog'),
    TextInput: mockComponent('TextInput'),
    Button: mockComponent('Button'),
    IconButton: mockComponent('IconButton'),
    Menu: mockComponent('Menu'),
    Snackbar: mockComponent('Snackbar'),
    Card: {
      ...mockComponent('Card'),
      Title: mockComponent('Card.Title'),
      Content: mockComponent('Card.Content'),
      Actions: mockComponent('Card.Actions'),
      Cover: mockComponent('Card.Cover'),
    },
    Surface: mockComponent('Surface'),
    Divider: mockComponent('Divider'),
    Chip: mockComponent('Chip'),
    RadioButton: {
      Group: mockComponent('RadioButton.Group'),
      Item: mockComponent('RadioButton.Item'),
    },
    Switch: mockComponent('Switch'),
    ProgressBar: mockComponent('ProgressBar'),
    Avatar: {
      Image: mockComponent('Avatar.Image'),
      Text: mockComponent('Avatar.Text'),
      Icon: mockComponent('Avatar.Icon'),
    },
    Tooltip: mockComponent('Tooltip'),
  },
  '@expo/vector-icons/MaterialCommunityIcons': mockComponent('MaterialCommunityIcons'),
  '@expo/vector-icons/Feather': mockComponent('Feather'),
  '@expo/vector-icons/Ionicons': mockComponent('Ionicons'),
  'expo-updates': {
    isEnabled: false,
    checkForUpdateAsync: async () => ({ isAvailable: false }),
    fetchUpdateAsync: async () => ({ isNew: false }),
    reloadAsync: async () => {},
  },
  // Without this, requiring ProfileScreen pulls in the real expo-constants,
  // which reaches into expo-modules-core's .ts sources and crashes the runner.
  'expo-constants': {
    default: {
      expoConfig: { version: "2.2.0", extra: {} },
      easConfig: null,
    },
  },
  // Every screen imports icons from here. The real package is a barrel over
  // ~1600 icon modules; loading it made the screens suite take tens of seconds
  // and time out on slower machines. This Proxy hands back a mock component for
  // whatever icon name is requested, so new icons never need registering.
  'lucide-react-native': new Proxy({}, {
    get: (target, prop) => {
      if (prop === '__esModule') return true;
      if (typeof prop !== 'string') return undefined;
      if (!target[prop]) target[prop] = mockComponent(prop);
      return target[prop];
    },
    has: () => true,
  }),
  '@react-navigation/native': {
    NavigationContainer: mockComponent('NavigationContainer'),
    DarkTheme: {
      colors: { primary: '#1e88e5', background: '#121212', surface: '#1e1e1e', text: '#ffffff', border: '#2c2c2c', notification: '#cf6679' },
      fonts: { regular: { fontFamily: '', fontWeight: '400' }, medium: { fontFamily: '', fontWeight: '500' }, bold: { fontFamily: '', fontWeight: '700' }, heavy: { fontFamily: '', fontWeight: '900' } }
    },
    useNavigation: () => ({ setOptions: () => {}, navigate: () => {}, goBack: () => {} }),
    useRoute: () => ({ params: {} }),
  },
  '@react-navigation/native-stack': {
    createNativeStackNavigator: () => ({
      Navigator: mockComponent('NativeStackNavigator'),
      Screen: mockComponent('NativeStackScreen')
    })
  },
  '@react-navigation/bottom-tabs': {
    createBottomTabNavigator: () => ({
      Navigator: mockComponent('BottomTabNavigator'),
      Screen: mockComponent('BottomTabScreen')
    })
  },
  'firebase/app': {
    initializeApp: () => ({})
  },
  'firebase/storage': {
    getStorage: () => ({})
  },
  'firebase/auth': {
    getAuth: () => mockAuth,
    initializeAuth: () => mockAuth,
    getReactNativePersistence: () => ({}),
    GoogleAuthProvider: {
      credential: (token) => ({ providerId: 'google.com', token })
    },
    signInWithCredential: async (auth, cred) => {
      mockAuth.currentUser = mockCurrentUser;
      return { user: mockCurrentUser };
    },
    signOut: async (auth) => {
      mockAuth.currentUser = null;
      if (mockAuth._onAuthStateChangedCb) {
        mockAuth._onAuthStateChangedCb(null);
      }
    }
  },
  'firebase/firestore': {
    getFirestore: () => ({}),
    initializeFirestore: () => ({}),
    memoryLocalCache: () => ({}),
    collection: (db, path) => ({ type: 'collection', path }),
    doc: (db, arg1, arg2) => {
      let docPath;
      if (arg2 !== undefined) {
        docPath = `${arg1}/${arg2}`;
      } else {
        docPath = arg1;
      }
      const id = docPath.split('/').pop();
      return { type: 'doc', path: docPath, id };
    },
    query: (colRef, ...constraints) => ({ type: 'query', colRef, constraints }),
    where: (field, op, val) => ({ type: 'where', field, op, val }),
    orderBy: (field, dir) => ({ type: 'orderBy', field, dir }),
    onSnapshot: (target, callback, errorCb) => {
      let docs = [];
      const targetPath = target.path || target.colRef?.path;
      for (const [p, data] of firestoreStore.entries()) {
        if (target.type === 'doc') {
          if (p === targetPath) {
            callback({
              exists: () => true,
              id: target.id,
              data: () => data
            });
            return () => {};
          }
        } else {
          if (p.startsWith(targetPath + '/')) {
            docs.push({ id: p.split('/').pop(), data: () => data });
          }
        }
      }
      if (target.type === 'doc') {
        callback({ exists: () => false, id: target.id, data: () => null });
      } else {
        callback({ docs });
      }
      return () => {};
    },
    getDoc: async (docRef) => {
      const data = firestoreStore.get(docRef.path);
      return {
        exists: () => !!data,
        id: docRef.id,
        data: () => data
      };
    },
    getDocs: async (target) => {
      const targetPath = target.path || target.colRef?.path;
      const docs = [];
      for (const [p, data] of firestoreStore.entries()) {
        if (p.startsWith(targetPath + '/')) {
          docs.push({ id: p.split('/').pop(), data: () => data });
        }
      }
      return { docs };
    },
    addDoc: async (colRef, data) => {
      const id = 'doc_' + Math.random().toString(36).substr(2, 9);
      const fullPath = `${colRef.path}/${id}`;
      firestoreStore.set(fullPath, data);
      return { id, path: fullPath };
    },
    updateDoc: async (docRef, updateData) => {
      if (!firestoreStore.has(docRef.path) || mockDocMissing) {
        const err = new Error(`FirebaseError: No document to update: ${docRef.path}`);
        err.code = 'not-found';
        throw err;
      }
      const existing = firestoreStore.get(docRef.path) || {};
      firestoreStore.set(docRef.path, { ...existing, ...updateData });
    },
    setDoc: async (docRef, data, options = {}) => {
      if (options.merge) {
        const existing = firestoreStore.get(docRef.path) || {};
        firestoreStore.set(docRef.path, { ...existing, ...data });
      } else {
        firestoreStore.set(docRef.path, data);
      }
    },
    deleteDoc: async (docRef) => {
      firestoreStore.delete(docRef.path);
    },
    serverTimestamp: () => ({ seconds: Math.floor(Date.now() / 1000) })
  }
};

Module._load = function(request, parent, isMain) {
  if (mockModules[request]) {
    return mockModules[request];
  }
  return originalLoad.apply(this, arguments);
};

// On-disk transform cache. Every require of a src/ file used to re-run Babel,
// which made a cold full-suite run take tens of seconds and occasionally blow
// past CI timeouts. Cache entries are keyed by content hash, so edits
// invalidate themselves and a stale cache can never mask a change.
const crypto = require('crypto');
const CACHE_DIR = path.join(__dirname, '..', 'node_modules', '.cache', 'rfv-tests');
try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* cache is optional */ }

const transformCached = (content, filename) => {
  const key = crypto
    .createHash('sha1')
    .update(filename)
    .update('\0')
    .update(content)
    .digest('hex');
  const cachePath = path.join(CACHE_DIR, key + '.js');

  try {
    return fs.readFileSync(cachePath, 'utf8');
  } catch {
    // Cache miss — fall through and compile.
  }

  const { code } = babel.transformSync(content, {
    filename,
    presets: [
      require.resolve('@babel/preset-typescript')
    ],
    plugins: [
      require.resolve('@babel/plugin-transform-flow-strip-types'),
      require.resolve('@babel/plugin-transform-modules-commonjs'),
      [require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'classic' }]
    ]
  });

  try { fs.writeFileSync(cachePath, code); } catch { /* cache is optional */ }
  return code;
};

// Register require hook for local JS and TS/TSX files in src/
const compileFile = function(module, filename) {
  if (filename.includes('node_modules')) {
    return module._compile(fs.readFileSync(filename, 'utf8'), filename);
  }
  const content = fs.readFileSync(filename, 'utf8');
  module._compile(transformCached(content, filename), filename);
};

require.extensions['.js'] = compileFile;
require.extensions['.jsx'] = compileFile;
require.extensions['.ts'] = compileFile;
require.extensions['.tsx'] = compileFile;

module.exports = {
  firestoreStore,
  mockAuth,
  setMockDocMissing: (val) => { mockDocMissing = val; },
  setMockClaims: (claims) => {
    mockClaims = claims;
    if (mockCurrentUser) {
      mockCurrentUser.getIdTokenResult = async () => ({ claims });
    }
  },
  setMockCurrentUser: (user) => {
    mockCurrentUser = user;
    mockAuth.currentUser = user;
  },
  resetMocks: () => {
    firestoreStore.clear();
    mockDocMissing = false;
    mockClaims = {};
    mockCurrentUser = {
      email: 'test@teamrotor.com',
      getIdToken: async () => 'mock-id-token-123',
      getIdTokenResult: async () => ({ claims: mockClaims })
    };
    mockAuth.currentUser = mockCurrentUser;
    global.fetchCalls = [];
    global.lastAlert = null;
  }
};
