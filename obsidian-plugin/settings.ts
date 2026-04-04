import { App, PluginSettingTab, Setting } from "obsidian";
import type ResearchWikiPlugin from "./main";

export interface ResearchWikiSettings {
  apiUrl: string;
  apiKey: string;
}

export class ResearchWikiSettingTab extends PluginSettingTab {
  plugin: ResearchWikiPlugin;

  constructor(app: App, plugin: ResearchWikiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Research Wiki" });

    new Setting(containerEl)
      .setName("API URL")
      .setDesc("Base URL of your Research Wiki instance")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:3000")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc(
        "Your personal API key. Generate one from the wiki's API key settings."
      )
      .addText((text) =>
        text
          .setPlaceholder("ak_...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
