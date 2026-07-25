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
    }
  },
  'expo-sharing': {
    isAvailableAsync: async () => true,
    shareAsync: async () => {},
  },
  'expo-camera': {
    Camera: mockComponent('Camera'),
    CameraView: mockComponent('CameraView'),
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
    default: { createAnimatedComponent: (c) => c },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
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
    ScrollView: mockComponent('ScrollView'),
    FlatList: mockComponent('FlatList'),
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
    Alert: {
      alert: (title, message) => {
        global.lastAlert = { title, message };
      }
    },
    StyleSheet: {
      create: (styles) => styles
    }
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
  },
  '@expo/vector-icons/MaterialCommunityIcons': mockComponent('MaterialCommunityIcons'),
  'expo-updates': {
    isEnabled: false,
    checkForUpdateAsync: async () => ({ isAvailable: false }),
    fetchUpdateAsync: async () => ({ isNew: false }),
    reloadAsync: async () => {},
  },
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

// Register require hook for local JS and TS/TSX files in src/
const compileFile = function(module, filename) {
  if (filename.includes('node_modules')) {
    return module._compile(fs.readFileSync(filename, 'utf8'), filename);
  }
  const content = fs.readFileSync(filename, 'utf8');
  const transformed = babel.transformSync(content, {
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
  module._compile(transformed.code, filename);
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
