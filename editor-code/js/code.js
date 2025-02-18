/*
 * Copyright (c) 2024 Eclipse Dirigible contributors
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-FileCopyrightText: Eclipse Dirigible contributors
 * SPDX-License-Identifier: EPL-2.0
 */
// @ts-ignore
require.config({
    paths: {
        'vs': '/webjars/monaco-editor/min/vs',
        'parser': 'js/parser'
    }
});
const editor = angular.module('editor', ['blimpKit', 'platformView', 'platformShortcuts', 'WorkspaceService']);
editor.controller('EditorController', ($scope, $window, WorkspaceService, ViewParameters) => {
    const statusBarHub = new StatusBarHub();
    const workspaceHub = new WorkspaceHub();
    const layoutHub = new LayoutHub();
    $scope.state = {
        isBusy: true,
        error: false,
        busyText: 'Loading...',
    };

    let fileData;
    let editor;

    function initMonaco(monaco) {
        if (!SharedCodeContext.models.hasOwnProperty($scope.dataParameters.filePath)) {
            const model = monaco.editor.createModel(fileData, 'javascript');
            SharedCodeContext.models[$scope.dataParameters.filePath] = model;
        } else {
            console.log('loaded from shared context')
        }
        editor = monaco.editor.create(document.getElementById('monaco'), {
            model: SharedCodeContext.models[$scope.dataParameters.filePath],
            automaticLayout: true,
        });

        window.onresize = () => { editor.layout(); };
    }


    angular.element($window).bind('focus', () => {
        statusBarHub.showLabel('');
    });

    $scope.modelChange = () => {
        layoutHub.setEditorDirty({
            path: $scope.dataParameters.filePath,
            dirty: true,
        });
    };

    $scope.saveAction = (keySet = 'ctrl+s', event) => {
        event?.preventDefault();
        if (keySet === 'ctrl+s') {
            $scope.state.isBusy = true;
            WorkspaceService.saveContent($scope.dataParameters.filePath, $scope.file.model).then(() => {
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
                });
            }, (response) => {
                console.error(response);
                $scope.$evalAsync(() => {
                    $scope.state.error = true;
                    $scope.errorMessage = 'Error while saving file';
                    $scope.state.isBusy = false;
                });
            });
        }
    };

    const loadFileContents = () => {
        $scope.state.isBusy = true;
        WorkspaceService.loadContent($scope.dataParameters.filePath).then((response) => {
            $scope.$evalAsync(() => {
                fileData = response.data;
                // @ts-ignore
                require(['vs/editor/editor.main'], initMonaco);
                $scope.state.isBusy = false;
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

    layoutHub.onFocusEditor((data) => {
        if (data.path && data.path === $scope.dataParameters.filePath) statusBarHub.showLabel('');
    });

    layoutHub.onReloadEditorParams((data) => {
        if (data.path === $scope.dataParameters.filePath) {
            $scope.$evalAsync(() => {
                $scope.dataParameters = ViewParameters.get();
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

    $scope.dataParameters = ViewParameters.get();
    if (!$scope.dataParameters.hasOwnProperty('filePath')) {
        $scope.state.error = true;
        $scope.errorMessage = "The 'filePath' data parameter is missing.";
    } else {
        loadFileContents();
    }
});