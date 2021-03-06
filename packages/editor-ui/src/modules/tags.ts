import { ActionContext, Module } from 'vuex';
import {
	ITag,
	ITagsState,
	IRootState,
} from '../Interface';
import { createTag, deleteTag, getTags, updateTag } from '../api/tags';
import Vue from 'vue';

const module: Module<ITagsState, IRootState> = {
	namespaced: true,
	state: {
		tags: {},
		isLoading: false,
		fetchedAll: false,
		fetchedUsageCount: false,
	},
	mutations: {
		setLoading: (state: ITagsState, isLoading: boolean) => {
			state.isLoading = isLoading;
		},
		setAllTags: (state: ITagsState, tags: ITag[]) => {
			state.tags = tags
				.reduce((accu: { [id: string]: ITag }, tag: ITag) => {
					accu[tag.id] = tag;

					return accu;
				}, {});
			state.fetchedAll = true;
		},
		upsertTags(state: ITagsState, tags: ITag[]) {
			tags.forEach((tag) => {
				const tagId = tag.id;
				const currentTag = state.tags[tagId];
				if (currentTag) {
					const newTag = {
						...currentTag,
						...tag,
					};
					Vue.set(state.tags, tagId, newTag);
				}
				else {
					Vue.set(state.tags, tagId, tag);
				}
			});
		},
		deleteTag(state: ITagsState, id: string) {
			Vue.delete(state.tags, id);
		},
	},
	getters: {
		allTags(state: ITagsState): ITag[] {
			return Object.values(state.tags)
				.sort((a, b) => a.name.localeCompare(b.name));
		},

		isLoading: (state: ITagsState): boolean => {
			return state.isLoading;
		},
		hasTags: (state: ITagsState): boolean => {
			return Object.keys(state.tags).length > 0;
		},
		getTagById: (state: ITagsState) => {
			return (id: string) => state.tags[id];
		},
	},
	actions: {
		fetchAll: async (context: ActionContext<ITagsState, IRootState>, params?: { roleId?: string, force?: boolean, withUsageCount?: boolean }) => {
			const { roleId = "", force = false, withUsageCount = false } = params || {};

			if (!force && context.state.fetchedAll && context.state.fetchedUsageCount === withUsageCount) {
				return context.state.tags;
			}

			context.commit('setLoading', true);
			const allTags = await getTags(context.rootGetters.getRestApiContext, Boolean(withUsageCount));
			let tagsForCurrentRole: ITag[] = [];

			if (roleId.toString() === "1"){
				tagsForCurrentRole = allTags;
			}
			else {
				allTags.forEach(tag => {

					if (tag.roleId === roleId.toString()) {
						tagsForCurrentRole.push(tag);
					}
				});
			}

			context.commit('setAllTags', tagsForCurrentRole);
			context.commit('setLoading', false);

			return tagsForCurrentRole;
		},

		create: async (context: ActionContext<ITagsState, IRootState>, { roleId, name }: { roleId: string, name: string }) => {
			const tag = await createTag(context.rootGetters.getRestApiContext, { roleId, name });
			context.commit('upsertTags', [tag]);

			return tag;
		},

		rename: async (context: ActionContext<ITagsState, IRootState>, { id, name }: { id: string, name: string }) => {
			const tag = await updateTag(context.rootGetters.getRestApiContext, id, { name });
			context.commit('upsertTags', [tag]);

			return tag;
		},

		delete: async (context: ActionContext<ITagsState, IRootState>, id: string) => {
			const deleted = await deleteTag(context.rootGetters.getRestApiContext, id);

			if (deleted) {
				context.commit('deleteTag', id);
				context.commit('removeWorkflowTagId', id, {root: true});
			}

			return deleted;
		},
	},
};

export default module;
