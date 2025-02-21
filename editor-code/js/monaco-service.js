// @ts-ignore
require.config({
    paths: {
        'vs': '/webjars/monaco-editor/min/vs',
        'parser': 'js/parser'
    }
});
// @ts-ignore
top.MonacoModels = {};
// @ts-ignore
require(['vs/editor/editor.main'], () => {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        diagnosticCodesToIgnore: [
            2792, // Cannot find module - for local module imports
            6196, // declared but never used - class
            1219, // Experimental support for decorators
            2307,
            2304, // Cannot find name 'exports'(2304)
            2683, // 'this' implicitly has type 'any' because it does not have a type annotation.(2683)
            7005, // Variable 'ctx' implicitly has an 'any' type.(7005)
            7006, // Parameter 'ctx' implicitly has an 'any' type.(7006),
            7009, // 'new' expression, whose target lacks a construct signature, implicitly has an 'any' type.(7009)
            7034, // Variable 'ctx' implicitly has type 'any' in some locations where its type cannot be determined.(7034)
        ]
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        diagnosticCodesToIgnore: [
            6196, // declared but never used - class
            1219, // Experimental support for decorators
        ]
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        strict: true,
        strictNullChecks: true,
        strictPropertyInitialization: true,
        alwaysStrict: true,
        allowNonTsExtensions: true,
        allowUnreachableCode: false,
        allowUnusedLabels: false,
        noUnusedParameters: true,
        noUnusedLocals: true,
        checkJs: true,
        noFallthroughCasesInSwitch: true,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        resolveJsonModule: true,
        jsx: monaco.languages.typescript.JsxEmit.React
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        strict: true,
        strictNullChecks: true,
        strictPropertyInitialization: true,
        alwaysStrict: true,
        allowNonTsExtensions: true,
        allowUnreachableCode: false,
        allowUnusedLabels: false,
        noUnusedParameters: true,
        noUnusedLocals: true,
        checkJs: true,
        noFallthroughCasesInSwitch: true,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        resolveJsonModule: true,
        jsx: monaco.languages.typescript.JsxEmit.React
    });

    monaco.languages.typescript.javascriptDefaults.addExtraLib('/** $. XSJS API */ var $: any;', 'ts:$.js');

    monaco.languages.html.registerHTMLLanguageService('xml', {}, { documentFormattingEdits: true });

    monaco.languages.html.htmlDefaults.setOptions({
        format: {
            tabSize: 2,
            insertSpaces: true,
            endWithNewline: true,
            indentHandlebars: true,
            indentInnerHtml: true,
            wrapLineLength: 240,
            wrapAttributes: 'auto',
            extraLiners: 'head, body, /html',
            maxPreserveNewLines: null
        }
    });

    monaco.languages.registerImplementationProvider('typescript', {
        provideImplementation: (model, position) => {
            const filePath = getTypeScriptFileImport(model, position, fileObject);
            if (filePath) {
                layoutHub.openEditor({
                    path: filePath,
                    contentType: 'typescript',
                });
            }
        }
    });

    monaco.languages.registerDefinitionProvider('typescript', {
        provideDefinition: (model, position) => {
            return [{
                uri: model.uri,
                range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            }];
        }
    });

    monaco.editor.defineTheme('blimpkit-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [{ background: '1d1d1d' }],
        colors: {
            'editor.background': '#1d1d1d',
            'breadcrumb.background': '#1d1d1d',
            'minimap.background': '#1d1d1d',
            'editorGutter.background': '#1d1d1d',
            'editorMarkerNavigation.background': '#1d1d1d',
            'input.background': '#242424',
            'input.border': '#4e4e4e',
            'editorWidget.background': '#1d1d1d',
            'editorWidget.border': '#313131',
            'editorSuggestWidget.background': '#262626',
            'dropdown.background': '#262626',
        }
    });

    monaco.editor.defineTheme('classic-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [{ background: '1c2228' }],
        colors: {
            'editor.background': '#1c2228',
            'breadcrumb.background': '#1c2228',
            'minimap.background': '#1c2228',
            'editorGutter.background': '#1c2228',
            'editorMarkerNavigation.background': '#1c2228',
            'input.background': '#29313a',
            'input.border': '#8696a9',
            'editorWidget.background': '#1c2228',
            'editorWidget.border': '#495767',
            'editorSuggestWidget.background': '#29313a',
            'dropdown.background': '#29313a',
        }
    });

    const getTheme = (theme) => {
        if (theme.type === 'light') {
            return 'vs-light';
        } else if (theme.type === 'dark') {
            if (theme.id === 'classic-dark') return 'classic-dark';
            else return 'blimpkit-dark';
        } else {
            if ($window.matchMedia && $window.matchMedia('(prefers-color-scheme: dark)').matches) {
                if (theme.id.startsWith('classic')) return 'classic-dark';
                else return 'blimpkit-dark';
            } else return 'vs-light';
        }
    };

    themeChangeListener = themingHub.onThemeChange((theme) => {
        monaco.editor.setTheme(getTheme(theme));
    });

    const layoutHub = new LayoutHub();
    layoutHub.onCloseEditor((data) => {
        console.log(data)
    });
});