/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from "./openshiftItem";
import { OpenShiftObject } from "../odo";
import * as vscode from 'vscode';
import * as validator from 'validator';

export class Storage extends OpenShiftItem {
    static async create(context: OpenShiftObject): Promise<string> {
        const component: OpenShiftObject = context;
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const storageName = await vscode.window.showInputBox({prompt: "Specify the storage name", validateInput: (value: string) => {
            if (validator.isEmpty(value.trim())) {
                return 'Invalid storage name';
            }
        }});
        if (!storageName) return null;

        const mountPath = await vscode.window.showInputBox({prompt: "Specify the mount path", validateInput: (value: string) => {
            if (validator.isEmpty(value.trim())) {
                return 'Invalid mount path';
            }
        }});
        if (!mountPath) return null;

        const storageSize = await vscode.window.showQuickPick(['1Gi', '1.5Gi', '2Gi'], {placeHolder: 'Select the storage size'});
        if (!storageSize) return null;

        return Promise.resolve()
            .then(() => Storage.odo.execute(`odo storage create ${storageName} --path=${mountPath} --size=${storageSize} --project ${project.getName()} --app ${app.getName()} --component ${component.getName()}`))
            .then(() => Storage.explorer.refresh(context))
            .then(() => `Storage '${storageName}' successfully created for component '${context.getName()}'`)
            .catch((err) => Promise.reject(`New Storage command failed with error: '${err}'!`));
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let project: OpenShiftObject;
        let component: OpenShiftObject;
        let application: OpenShiftObject;
        let storage: OpenShiftObject = treeItem;
        if (!storage) {
            project = await vscode.window.showQuickPick(Storage.odo.getProjects(), {placeHolder: "From which project you want to delete storage"});
            if (project) {
                application = await vscode.window.showQuickPick(Storage.odo.getApplications(project), {placeHolder: "From which application you want to delete storage"});
            }
            if (application) {
                component = await vscode.window.showQuickPick(Storage.odo.getComponents(application), {placeHolder: "From which component you want ot delete storage"});
            }
            if (component) {
                storage = await vscode.window.showQuickPick(Storage.odo.getStorageNames(component), {placeHolder: "Select storage to delete"});
            }
        }
        if (storage) {
            const component: OpenShiftObject = storage.getParent();
            const app: OpenShiftObject = component.getParent();
            project = app.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete storage '${storage.getName()}' from component '${component.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Promise.resolve()
                    .then(() => Storage.odo.execute(`odo storage delete ${storage.getName()} -f --project ${project.getName()} --app ${app.getName()} --component ${component.getName()}`))
                    .then(() => Storage.explorer.refresh(treeItem ? component : undefined))
                    .then(() => `Storage '${storage.getName()}' from component '${component.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete storage with error '${err}'`));
            }
        }
        return null;
    }
}