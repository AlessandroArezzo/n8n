import {  ActionContext, Module } from 'vuex';
import {
	ILogLevel,
	IN8nPrompts,
	IN8nUISettings,
	IN8nValueSurveyData, IRoleDb, IRoleDropdown,
	IRootState,
	ISettingsState, ITag,
} from '../Interface';
import { getPromptsData, submitValueSurvey, submitContactInfo, getSettings, getRoles} from '../api/settings';
import Vue from 'vue';
import { CONTACT_PROMPT_MODAL_KEY, VALUE_SURVEY_MODAL_KEY } from '@/constants';
import { ITelemetrySettings } from 'n8n-workflow';
import { testHealthEndpoint } from '@/api/templates';

const module: Module<ISettingsState, IRootState> = {
	namespaced: true,
	state: {
		settings: {} as IN8nUISettings,
		promptsData: {} as IN8nPrompts,
		userManagement: {
			enabled: false,
			showSetupOnFirstLoad: false,
			smtpSetup: false,
		},
		templatesEndpointHealthy: false,
		roles: {},
	},
	getters: {
		versionCli(state: ISettingsState) {
			return state.settings.versionCli;
		},
		isUserManagementEnabled(state: ISettingsState): boolean {
			return state.userManagement.enabled;
		},
		showSetupPage(state: ISettingsState) {
			return state.userManagement.showSetupOnFirstLoad;
		},
		getPromptsData(state: ISettingsState) {
			return state.promptsData;
		},
		isSmtpSetup(state: ISettingsState) {
			return state.userManagement.smtpSetup;
		},
		isPersonalizationSurveyEnabled(state: ISettingsState) {
			return state.settings.telemetry.enabled && state.settings.personalizationSurveyEnabled;
		},
		telemetry: (state): ITelemetrySettings => {
			return state.settings.telemetry;
		},
		logLevel: (state): ILogLevel => {
			return state.settings.logLevel;
		},
		isTelemetryEnabled: (state) => {
			return state.settings.telemetry && state.settings.telemetry.enabled;
		},
		areTagsEnabled: (state) => {
			return state.settings.workflowTagsDisabled !== undefined ? !state.settings.workflowTagsDisabled : true;
		},
		isHiringBannerEnabled: (state): boolean => {
			return state.settings.hiringBannerEnabled;
		},
		isTemplatesEnabled: (state): boolean => {
			return Boolean(state.settings.templates && state.settings.templates.enabled);
		},
		isTemplatesEndpointReachable: (state): boolean => {
			return state.templatesEndpointHealthy;
		},
		templatesHost: (state): string  => {
			return state.settings.templates.host;
		},
		allRoles(state: ISettingsState): IRoleDb[] {
			return Object.values(state.roles)
				.sort((a, b) => a.name.localeCompare(b.name));
		},
		allRolesToShow(state: ISettingsState): IRoleDropdown[] {
			const allRoles = Object.values(state.roles)
				.sort((a, b) => a.name.localeCompare(b.name));
			const rolesToShow: IRoleDropdown[] = [];
			allRoles.forEach(role => {
				// not showed role with ids 1,3,4: roles for the owner in db
				if (role.id !== 1 && role.id !== 3 && role.id !== 4) {
					rolesToShow.push({
						value: role.id,
						label: role.name,
					});
				}
			});
			return rolesToShow;
		},
	},
	mutations: {
		setSettings(state: ISettingsState, settings: IN8nUISettings) {
			state.settings = settings;
			state.userManagement.enabled = settings.userManagement.enabled;
			state.userManagement.showSetupOnFirstLoad = !!settings.userManagement.showSetupOnFirstLoad;
			state.userManagement.smtpSetup = settings.userManagement.smtpSetup;
		},
		stopShowingSetupPage(state: ISettingsState) {
			Vue.set(state.userManagement, 'showSetupOnFirstLoad', false);
		},
		setPromptsData(state: ISettingsState, promptsData: IN8nPrompts) {
			Vue.set(state, 'promptsData', promptsData);
		},
		setTemplatesEndpointHealthy(state: ISettingsState) {
			state.templatesEndpointHealthy = true;
		},
		setAllRoles: (state: ISettingsState, roles: IRoleDb[]) => {
			state.roles = roles
				.reduce((accu: { [id: string]: IRoleDb }, role: IRoleDb) => {
					accu[role.id] = role;

					return accu;
				}, {});
		},
	},
	actions: {
		async getSettings(context: ActionContext<ISettingsState, IRootState>) {
			const settings = await getSettings(context.rootGetters.getRestApiContext);
			context.commit('setSettings', settings);

			// todo refactor to this store
			context.commit('setUrlBaseWebhook', settings.urlBaseWebhook, {root: true});
			context.commit('setEndpointWebhook', settings.endpointWebhook, {root: true});
			context.commit('setEndpointWebhookTest', settings.endpointWebhookTest, {root: true});
			context.commit('setSaveDataErrorExecution', settings.saveDataErrorExecution, {root: true});
			context.commit('setSaveDataSuccessExecution', settings.saveDataSuccessExecution, {root: true});
			context.commit('setSaveManualExecutions', settings.saveManualExecutions, {root: true});
			context.commit('setTimezone', settings.timezone, {root: true});
			context.commit('setExecutionTimeout', settings.executionTimeout, {root: true});
			context.commit('setMaxExecutionTimeout', settings.maxExecutionTimeout, {root: true});
			context.commit('setVersionCli', settings.versionCli, {root: true});
			context.commit('setInstanceId', settings.instanceId, {root: true});
			context.commit('setOauthCallbackUrls', settings.oauthCallbackUrls, {root: true});
			context.commit('setN8nMetadata', settings.n8nMetadata || {}, {root: true});
			context.commit('setDefaultLocale', settings.defaultLocale, {root: true});
			context.commit('versions/setVersionNotificationSettings', settings.versionNotifications, {root: true});
		},
		async fetchPromptsData(context: ActionContext<ISettingsState, IRootState>) {
			if (!context.getters.isTelemetryEnabled) {
				return;
			}

			try {
				const instanceId = context.state.settings.instanceId;
				const userId = context.rootGetters['users/currentUserId'];
				const promptsData: IN8nPrompts = await getPromptsData(instanceId, userId);

				if (promptsData && promptsData.showContactPrompt) {
					context.commit('ui/openModal', CONTACT_PROMPT_MODAL_KEY, {root: true});
				} else if (promptsData && promptsData.showValueSurvey) {
					context.commit('ui/openModal', VALUE_SURVEY_MODAL_KEY, {root: true});
				}

				context.commit('setPromptsData', promptsData);
			} catch (e) {
				return e;
			}

		},
		async submitContactInfo(context: ActionContext<ISettingsState, IRootState>, email: string) {
			try {
				const instanceId = context.state.settings.instanceId;
				const userId = context.rootGetters['users/currentUserId'];
				return await submitContactInfo(instanceId, userId, email);
			} catch (e) {
				return e;
			}
		},
		async submitValueSurvey(context: ActionContext<ISettingsState, IRootState>, params: IN8nValueSurveyData) {
			try {
				const instanceId = context.state.settings.instanceId;
				const userId = context.rootGetters['users/currentUserId'];
				return await submitValueSurvey(instanceId, userId, params);
			} catch (e) {
				return e;
			}
		},
		async testTemplatesEndpoint(context: ActionContext<ISettingsState, IRootState>) {
			const timeout = new Promise((_, reject) => setTimeout(() => reject(), 2000));
			await Promise.race([testHealthEndpoint(context.getters.templatesHost), timeout]);
			context.commit('setTemplatesEndpointHealthy', true);
		},
		async fetchRoles(context: ActionContext<ISettingsState, IRootState>) {
			const roles = await getRoles(context.rootGetters.getRestApiContext);
			context.commit('setAllRoles', roles);
		},
	},
};

export default module;
