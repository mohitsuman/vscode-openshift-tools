import { Odo, OdoImpl } from "../odo";
import { OpenShiftExplorer } from "../explorer";
import * as vscode from 'vscode';
import * as validator from 'validator';
import { CliExitData } from "../cli";

export class Cluster {
    private static odo: Odo = OdoImpl.getInstance();
    private static explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static async login(): Promise<string> {
        if (await Cluster.odo.requireLogin()) {
            return Cluster.loginDialog();
        } else {
            const value = await vscode.window.showInformationMessage(`You are already logged in the cluster. Do you want to login to a different cluster?`, 'Yes', 'No');
            if (value === 'Yes') {
                return Cluster.odo.execute(`oc logout`).then(async (result)=> {
                    if (result.stderr === "") {
                        return Cluster.loginDialog();
                    } else {
                        return Promise.reject(`Failed to logout of the current cluster with '${result.stderr}'!`);
                    }
                }).catch((error) => { return Promise.reject(`Failed to logout of the current cluster with '${error}'!`); });
            }
            return Promise.resolve(null);
        }
    }

    static async logout(): Promise<string> {
        const value = await vscode.window.showWarningMessage(`Are you sure you want to logout of cluster`, 'Logout', 'Cancel');
        if (value === 'Logout') {
            return Cluster.odo.execute(`oc logout`).then(async (result)=> {
                if (result.stderr === "") {
                    Cluster.explorer.refresh();
                    vscode.commands.executeCommand('setContext', 'isLoggedIn', false);
                    const logoutInfo = await vscode.window.showInformationMessage(`Successfully logged out. Do you want to login to a new cluster`, 'Yes', 'No');
                    if (logoutInfo === 'Yes') {
                        return Cluster.login();
                    } else {
                        return Promise.resolve(null);
                    }
                }
            }).catch((error) => {
                return Promise.reject(`Failed to logout of the current cluster with '${error}'!`);
            });
        }
    }

    static refresh(): void {
        Cluster.explorer.refresh();
    }

    static about(): void {
        Cluster.odo.executeInTerminal(`odo version`, process.cwd());
    }

    private static async loginDialog(): Promise<string> {
        const clusterURL = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: "Provide URL of the cluster to connect",
            validateInput: (value: string) => {
                if (!validator.isURL(value)) {
                    return 'Invalid URL provided';
                }
            }
        });
        if (!clusterURL) return Promise.resolve(null);
        const loginMethod = await vscode.window.showQuickPick(['Credentials', 'Token'], {placeHolder: 'Select the way to log in to the cluster.'});
        if (loginMethod === "Credentials") {
            return Cluster.credentialsLogin(clusterURL);
        } else {
            return Cluster.tokenLogin(clusterURL);
        }
    }

    private static async credentialsLogin(clusterURL: string): Promise<string> {
        const username = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: "Provide Username for basic authentication to the API server",
            validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Invalid Username';
                }
            }
        });
        if (!username) return Promise.resolve(null);
        const passwd  = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            prompt: "Provide Password for basic authentication to the API server"
        });
        if (!passwd) return Promise.resolve(null);
        return Promise.resolve()
            .then(() => Cluster.odo.execute(`oc login ${clusterURL} -u ${username} -p ${passwd}`))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => { return Promise.reject(`Failed to login to cluster '${clusterURL}' with '${error}'!`); });
    }

    private static async tokenLogin(clusterURL: string): Promise<string> {
        const ocToken  = await vscode.window.showInputBox({
            prompt: "Provide Bearer token for authentication to the API server",
            ignoreFocusOut: true
        });
        return Promise.resolve()
            .then(() => Cluster.odo.execute(`oc login ${clusterURL} --token=${ocToken}`))
            .then((result) => Cluster.loginMessage(clusterURL, result))
            .catch((error) => { return Promise.reject(`Failed to login to cluster '${clusterURL}' with '${error}'!`); });
    }

    private static loginMessage(clusterURL: string, result: CliExitData): Promise<string> {
        if (result.stderr === "") {
            Cluster.explorer.refresh();
            vscode.commands.executeCommand('setContext', 'isLoggedIn', true);
            return Promise.resolve(`Successfully logged in to '${clusterURL}'`);
        } else {
            return Promise.reject(`Failed to login to cluster '${clusterURL}' with '${result.stderr}'!`);
        }
    }
}