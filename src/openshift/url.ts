/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Command } from '../odo';
import { window, QuickPickItem } from 'vscode';
import { Component } from '../openshift/component';
import { V1ServicePort } from '@kubernetes/client-node';
import { OpenShiftItem } from './openshiftItem';
import { Progress } from "../util/progress";

export class Url extends OpenShiftItem{

    static async create(context: OpenShiftObject): Promise<string> {
        const component = await Url.getOpenShiftCmdData(context,
            'Select a Project to create a URL',
            'Select an Application to create a URL',
            'Select a Component you want to create a URL for');
        if (component) {
            const app: OpenShiftObject = component.getParent();
            const project: OpenShiftObject = app.getParent();
            const urlName = await window.showInputBox({
                prompt: `Provide a name for a URL`,
                validateInput: (value: string) => {
                    if (!value.trim()) return 'A name cannot be empty';
                }
            });
            if (!urlName) return null;
            const ports: V1ServicePort[] = await Component.getComponentPorts(component);
            const portItems: QuickPickItem[] = ports.map((item: any) => {
                item['label'] = `${item.port}/${item.protocol}`;
                return item;
            });
            let port: V1ServicePort | QuickPickItem;
            if (ports.length === 1) {
                port = ports[0];
            } else if (ports.length > 1) {
                port = await window.showQuickPick(portItems, {placeHolder: "Select port to expose"});
            } else {
                return Promise.reject(`Component '${component.getName()}' has no ports declared.`);
            }

            if (port) {
                return Progress.execFunctionWithProgress(`Creating a URL '${urlName}' for the Component '${component.getName()}'`,
                    () => Url.odo.execute(Command.createComponentCustomUrl(project.getName(), app.getName(), component.getName(), `${urlName}`, `${port['port']}`))
                        .then(() => `URL '${urlName}' for component '${component.getName()}' successfully created`)
                        .catch((err) => Promise.reject(`Failed to create URL '${urlName}' for component '${component.getName()}'. ${err.message}`))
                );
            }
        }
        return null;
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let url = treeItem;
        const component = await Url.getOpenShiftCmdData(url,
            "From which Project you want to delete Route",
            "From which Application you want to delete Route",
            "From which Component you want to delete Route");
        if (!url && component) {
            url = await window.showQuickPick(Url.odo.getRoutes(component), {placeHolder: `Select the desired URL to delete from the component ${component.getName()}`});
        }
        if (url) {
            const value = await window.showWarningMessage(`Do you want to delete Route '${url.getName()}' from Component '${url.getParent().getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting Route ${url.getName()} from Component ${component.getName()}`, () => Url.odo.deleteRoute(url))
                    .then(() => `Route '${url.getName()}' from Component '${url.getParent().getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete Route with error '${err}'`));
            }
        }
        return null;
    }
}