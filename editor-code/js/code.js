/*
 * Copyright (c) 2025 Eclipse Dirigible contributors
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-FileCopyrightText: Eclipse Dirigible contributors
 * SPDX-License-Identifier: EPL-2.0
 */
if (!top.hasOwnProperty('CodeEditorContext')) {
    top.CodeEditorContext = {
        models: {},
    };
}
const CodeEditorContext = top.CodeEditorContext;
// @ts-ignore
require.config({
    paths: {
        'vs': '/webjars/monaco-editor/min/vs',
        'parser': 'js/parser'
    }
});
let monacoInstance;
const editorApp = angular.module('editor', ['blimpKit', 'platformView', 'platformShortcuts', 'WorkspaceService', 'RepositoryService', 'RegistryService', 'GitService']);
editorApp.controller('EditorController', ($scope, $window, $http, WorkspaceService, RepositoryService, RegistryService, GitService, ViewParameters) => {
    const statusBarHub = new StatusBarHub();
    const workspaceHub = new WorkspaceHub();
    const layoutHub = new LayoutHub();
    const themingHub = new ThemingHub();
    const settings = {
        keys: {
            autoFormatExcluded: `${brandingInfo.keyPrefix}.code-editor.autoFormat.excluded`,
        },
        autoFormatEnabled: undefined,
        autoFormatFileExluded: undefined,
    };
    let autoFormatMenuAction;
    let themeChangeListener;
    $scope.state = {
        isBusy: true,
        error: false,
        busyText: 'Loading...',
    };

    let fileObject;
    const fileTypes = {
        '.abap': 'abap',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.mjs': 'javascript',
        '.cjs': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.table': 'json',
        '.view': 'json',
        '.extensionpoint': 'json',
        '.extension': 'json',
        '.job': 'json',
        '.xsjob': 'json',
        '.listener': 'json',
        '.access': 'json',
        '.roles': 'json',
        '.command': 'json',
        '.xml': 'xml',
        '.bpmn': 'xml',
        '.model': 'json',
        '.edm': 'xml',
        '.schema': 'json',
        '.odata': 'json',
        '.sql': 'sql',
        '.md': 'markdown',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.openapi': 'yaml',
        '.py': 'python',
        '.csvim': 'json',
        '.form': 'json',
        '.html.template': 'html',
        '.js.template': 'javascript',
        '.mjs.template': 'javascript',
        '.cjs.template': 'javascript',
        '.ts.template': 'typescript',
        '.tsx.template': 'typescript',
        '.extension.template': 'json',
        '.extensionpoint.template': 'json',
        '.table.template': 'json',
        '.view.template': 'json',
        '.form.template': 'json',
        '.json.template': 'json',
        '.job.template': 'json',
        '.svg.template': 'xml',
        '.report': 'json',
        'dockerfile': 'dockerfile',
    };
    let editor;
    let isGit = false;
    let isTemplateFile = false;
    let isDirty = false;

    function getFileType(fileName) {
        let ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
        if (ext === '.template') {
            isTemplateFile = true;
            ext = fileName.substring(fileName.lastIndexOf('.', fileName.lastIndexOf('.') - 1));
        }
        // @ts-ignore
        const fileType = fileTypes[ext] ?? 'text';
        return fileType;
    }

    function isAutoFormattingEnabled() {
        if (isTemplateFile) return false;
        if (settings.autoFormatEnabled === undefined) {
            const autoFormat = $window.localStorage.getItem(`${brandingInfo.keyPrefix}.code-editor.autoFormat`);
            settings.autoFormatEnabled = autoFormat === null || autoFormat === 'true';
        }
        return settings.autoFormatEnabled;
    }

    function isAutoBracketsEnabled() {
        const autoBracketsEnabled = $window.localStorage.getItem(`${brandingInfo.keyPrefix}.code-editor.autoBrackets`);
        return autoBracketsEnabled === null || autoBracketsEnabled === 'true';
    }

    function isMinimapAutohideEnabled() {
        const minimapAutohideEnabled = $window.localStorage.getItem(`${brandingInfo.keyPrefix}.code-editor.minimapAutohide`);
        return minimapAutohideEnabled === null || minimapAutohideEnabled === 'true';
    }

    function getRenderWhitespace() {
        const whitespace = $window.localStorage.getItem(`${brandingInfo.keyPrefix}.code-editor.whitespace`);
        return whitespace ?? 'trailing';
    }

    function getWordWrap() {
        const wordWrap = $window.localStorage.getItem(`${brandingInfo.keyPrefix}.code-editor.wordWrap`);
        return wordWrap ?? 'off';
    }

    const getTypeScriptFileImport = (model, position, fileObject) => {
        const lineContent = model.getLineContent(position.lineNumber);
        for (const next of fileObject.importedFilesNames) {
            if (lineContent.includes(next.replace(".ts", ""))) {
                console.log(next)
                return undefined;
                // return new FileIO().resolveFilePath(next);
            }
        }
        return undefined;
    }

    function isAutoFormattingEnabledForCurrentFile() {
        if (isTemplateFile) return false;
        if (settings.autoFormatFileExluded !== undefined) return settings.autoFormatFileExluded;
        const filesWithDisabledFormattingListJson = $window.localStorage.getItem(settings.keys.autoFormatExcluded);
        let filesWithDisabledFormattingList = undefined;
        if (filesWithDisabledFormattingListJson) {
            filesWithDisabledFormattingList = JSON.parse(filesWithDisabledFormattingListJson);
        }

        return !filesWithDisabledFormattingList || !filesWithDisabledFormattingList.includes($scope.dataParameters.filePath);
    }

    function toggleAutoFormatAction(enable) {
        if (enable && !autoFormatMenuAction) {
            autoFormatMenuAction = editor.addAction({
                id: 'code-editor-toggle-auto-formatting',
                label: isAutoFormattingEnabledForCurrentFile() ? 'Disable Auto-Formatting For File' : 'Enable Auto-Formatting For File',
                keybindings: [
                    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD
                ],
                precondition: null,
                keybindingContext: null,
                contextMenuGroupId: 'fileIO',
                contextMenuOrder: 1.5,
                run: () => {
                    const filesWithDisabledFormattingListJson = $window.localStorage.getItem(settings.keys.autoFormatExcluded);
                    let filesWithDisabledFormattingList = undefined;
                    if (filesWithDisabledFormattingListJson) {
                        filesWithDisabledFormattingList = JSON.parse(filesWithDisabledFormattingListJson);
                    }

                    let jsonString = null;

                    if (filesWithDisabledFormattingList) {
                        if (filesWithDisabledFormattingList.includes($scope.dataParameters.filePath)) {
                            const removed = filesWithDisabledFormattingList.filter(entry => entry !== $scope.dataParameters.filePath);
                            jsonString = JSON.stringify(removed);
                        } else {
                            filesWithDisabledFormattingList.push($scope.dataParameters.filePath);
                            jsonString = JSON.stringify(filesWithDisabledFormattingList);
                        }
                    } else {
                        let initialFilesWithDisabledFormattingList = new Array($scope.dataParameters.filePath);
                        jsonString = JSON.stringify(initialFilesWithDisabledFormattingList);
                    }

                    window.localStorage.setItem(settings.keys.autoFormatExcluded, jsonString);
                    themingHub.postMessage({ topic: 'code-editor.settings.update', data: { fileName: $scope.dataParameters.filePath } });
                }
            });
        } else {
            if (autoFormatMenuAction) {
                autoFormatMenuAction.dispose();
                autoFormatMenuAction = undefined;
            }
        }
    }

    function initEditor(fileContent, originalContent) {
        if (!CodeEditorContext.models.hasOwnProperty($scope.dataParameters.filePath)) {
            const mainFileUri = new monacoInstance.Uri().with({ path: $scope.dataParameters.filePath });
            const model = monacoInstance.editor.createModel(fileContent, getFileType($scope.dataParameters.filePath), mainFileUri);

            CodeEditorContext.models[$scope.dataParameters.filePath] = {
                model: model,
                inUseBy: []
            }
        }
        editor = monacoInstance.editor.create(document.getElementById('embeddedEditor'), {
            model: CodeEditorContext.models[$scope.dataParameters.filePath].model,
            automaticLayout: true,
            theme: getTheme(themingHub.getSavedTheme()),
            readOnly: $scope.dataParameters.readOnly,
            autoClosingBrackets: isAutoBracketsEnabled(),
            renderWhitespace: getRenderWhitespace(),
            wordWrap: getWordWrap(),
            minimap: {
                autohide: isMinimapAutohideEnabled(),
            }
        });

        if (!$scope.dataParameters.readOnly) {
            editor.onDidChangeModelContent(() => {
                modelChange();
            });
            editor.addAction({
                id: 'code-editor-files-save',
                label: 'Save',
                keybindings: [
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS
                ],
                precondition: null,
                keybindingContext: null,
                contextMenuGroupId: 'fileIO',
                contextMenuOrder: 1.5,
                run: (_editor) => {
                    if (isAutoFormattingEnabled() && isAutoFormattingEnabledForCurrentFile()) {
                        editor.getAction('editor.action.formatDocument').run().then(() => {
                            $scope.saveAction();
                        });
                    }
                    else $scope.saveAction();
                }
            });
        }

        toggleAutoFormatAction(isAutoFormattingEnabled());

        editor.addAction({
            id: 'code-editor-search',
            label: 'Search',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF
            ],
            precondition: null,
            keybindingContext: null,
            contextMenuGroupId: 'fileIO',
            contextMenuOrder: 1.5,
            run: () => {
                layoutHub.openView({ id: 'search' });
            }
        });

        editor.onDidChangeCursorPosition((e) => {
            statusBarHub.showLabel(`Line ${e.position.lineNumber}, Column ${e.position.column}`);
        });

        $scope.$evalAsync(() => {
            $scope.state.isBusy = false;
        });

        $window.onresize = () => { editor.layout(); };
    }


    angular.element($window).bind('focus', () => {
        statusBarHub.showLabel('');
    });

    const modelChange = () => {
        isDirty = true;
        layoutHub.setEditorDirty({
            path: $scope.dataParameters.filePath,
            dirty: true,
        });
    };

    $scope.saveAction = () => {
        if (isDirty) {
            $scope.state.isBusy = true;
            $scope.state.busyText = 'Saving...';
            WorkspaceService.saveContent( // TODO: Registry and Repository
                $scope.dataParameters.filePath,
                CodeEditorContext.models[$scope.dataParameters.filePath].model.getValue()
            ).then(() => {
                layoutHub.setEditorDirty({
                    path: $scope.dataParameters.filePath,
                    dirty: false,
                });
                workspaceHub.announceFileSaved({
                    path: $scope.dataParameters.filePath,
                    contentType: $scope.dataParameters.contentType,
                });
                $scope.$evalAsync(() => {
                    $scope.state.isBusy = false;
                    isDirty = false;
                });
            }, (response) => {
                console.error(response);
                $scope.$evalAsync(() => {
                    $scope.state.error = true;
                    $scope.errorMessage = 'Error while saving file';
                    $scope.state.isBusy = false;
                });
            }).finally(() => {
                $scope.state.busyText = 'Loading...';
            });
        }
    };

    const loadFileContents = () => {
        $scope.state.isBusy = true;
        let service;
        if ($scope.dataParameters.resourceType === 'workspace') {
            // /services/ide/git/workspace/editor-code/diff?path=editor-code/code.html
            if ($scope.dataParameters.gitName) {
                isGit = true;
                service = GitService
            } else service = WorkspaceService;
        } else if ($scope.dataParameters.resourceType === 'repository') {
            $scope.dataParameters.readOnly = true; // Repository has no write API
            service = RepositoryService;
        } else if ($scope.dataParameters.resourceType === 'registry') {
            $scope.dataParameters.readOnly = true; // Registry has no write API
            service = RegistryService;
        } else {
            $scope.state.isBusy = false;
            $scope.state.error = true;
            $scope.errorMessage = 'Unknown resource type';
            return;
        }
        service.loadContent($scope.dataParameters.filePath).then((response) => {
            // @ts-ignore
            require(['vs/editor/editor.main'], (monaco) => {
                monacoInstance = monaco;
                if (isGit) initEditor(response.data.modified, response.data.original);
                else initEditor(response.data);
            });
        }, (response) => {
            console.error(response);
            $scope.$evalAsync(() => {
                $scope.state.error = true;
                $scope.errorMessage = 'Error while loading file';
                $scope.state.isBusy = false;
            });
        });
    };

    themingHub.addMessageListener({
        topic: 'code-editor.settings.update', handler: (data) => {
            if (data.setting === 'autoFormatAll' && !isTemplateFile) {
                settings.autoFormatEnabled = data.value;
                toggleAutoFormatAction(data.value);
            } else if (data.setting === 'autoFormat' && !isTemplateFile) {
                // @ts-ignore
                settings.autoFormatFileExluded = isAutoFormattingEnabledForCurrentFile();
            } else if (data.setting === 'autoBrackets') {
                editor.updateOptions({ autoClosingBrackets: data.value });
            } else if (data.setting === 'minimapAutohide') {
                editor.updateOptions({ minimap: { autohide: data.value } });
            } else if (data.setting === 'whitespace') {
                editor.updateOptions({ renderWhitespace: data.value });
            } else if (data.setting === 'wordWrap') {
                editor.updateOptions({ wordWrap: data.value });
            }
        }
    });

    layoutHub.onFocusEditor((data) => {
        if (data.path && data.path === $scope.dataParameters.filePath) statusBarHub.showLabel('');
    });

    layoutHub.onReloadEditorParams((data) => {
        if (data.path === $scope.dataParameters.filePath) {
            $scope.$evalAsync(() => {
                $scope.dataParameters = ViewParameters.get();
                if ($scope.dataParameters.resourceType !== 'workspace') {
                    $scope.dataParameters.readOnly = true; // Registry/Repository has no write API
                }
            });
        };
    });

    workspaceHub.onSaveAll(() => {
        if (!$scope.state.error) {
            $scope.saveAction();
        }
    });

    workspaceHub.onSaveFile((data) => {
        if (!$scope.state.error && data.path && data.path === $scope.dataParameters.filePath) {
            $scope.saveAction();
        }
    });

    $scope.$on('$destroy', () => {
        themingHub.removeMessageListener(themeChangeListener);
    });

    $scope.dataParameters = ViewParameters.get();
    if (!$scope.dataParameters.hasOwnProperty('filePath')) {
        $scope.state.error = true;
        $scope.errorMessage = "The 'filePath' data parameter is missing.";
    } else {
        loadFileContents();
    }
});
