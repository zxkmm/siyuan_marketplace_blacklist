import { Plugin, showMessage } from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "menu-config";

var packageNameClass = document.getElementsByClassName("ft__on-surface");

export default class siyuan_rmv_btn extends Plugin {
  private settingUtils: SettingUtils;

  convertStringToArray(userInput) {
    if (userInput) {
      var inputArray = userInput.split(/[,，]/);
      for (let i = 0; i < inputArray.length; i++) {
        inputArray[i] = inputArray[i].trim();
      }
      return inputArray;
    } else {
      // 处理 undefined
      return [];
    }
  }

  applyStyles(css) {
    // console.log("applyStyles");
    // console.log(css);
    const head = document.head || document.getElementsByTagName("head")[0];
    const style = document.createElement("style");
    head.appendChild(style);
    style.appendChild(document.createTextNode(css));
  }

  rmvMarketPlaceCardsByNameJs(_toRemoveListArray_) {
    var siyuanMarketPlaceObserver = new MutationObserver(function (
      mutationsList,
      observer
    ) {
      for (var i = 0; i < packageNameClass.length; i++) {
        if (_toRemoveListArray_.includes(packageNameClass[i].textContent)) {
          if (packageNameClass[i].closest(".b3-card--wrap")) {
            packageNameClass[i].closest(".b3-card--wrap").style.display =
              "none";
          }
        }
      }
    });

    siyuanMarketPlaceObserver.observe(document, {
      childList: true,
      subtree: true,
      characterData: false,
    });
  }

  rmvMarketPlaceCardsByNameCss(_toRemovePackageNameListArray_) {
    /** core css
     *
     *
     * .b3-card.b3-card--wrap[data-obj*='"name":"siyuan_global_zoom"'] {
     *        display: none;
     * }
     *
     *
     */

    var _arr_with_css_ = [];
    for (var i = 0; i < _toRemovePackageNameListArray_.length; i++) {
      _arr_with_css_.push(
        `.b3-card.b3-card--wrap[data-obj*='"name":"${_toRemovePackageNameListArray_[i]}"'] {
            display: none;
        }`
      );
    }

    for (var i = 0; i < _arr_with_css_.length; i++) {
      this.applyStyles(_arr_with_css_[i]);
    }
  }

  rmvMarketPlaceCardsByGitHubUsernameCss(_toRemoveGitHubUsernameListArray_) {
    /**
     * fixd part of that identifier string: "repoURL":"https://github.com/{USERNAME}/
     *
     * core css
     *
     * .b3-card.b3-card--wrap[data-obj*='"repoURL":"https://github.com/${_toRemoveListArray_[i]}/'] {
     */

    var _arr_with_css_ = [];


    for (var i = 0; i < _toRemoveGitHubUsernameListArray_.length; i++) {
      _arr_with_css_.push(
        `.b3-card.b3-card--wrap[data-obj*='"repoURL":"https://github.com/${_toRemoveGitHubUsernameListArray_[i]}/'] {
            display: none;
        }`
      );
    }

    // console.log("arr_with_css" + _arr_with_css_);

    for (var i = 0; i < _arr_with_css_.length; i++) {
      this.applyStyles(_arr_with_css_[i]);
    }
  }

  reloadInterface() {
    // window.location.reload();
    showMessage(this.i18n.reload_hint);
  }

  async onload() {
    this.settingUtils = new SettingUtils(this, STORAGE_NAME);
    this.settingUtils.load();
    this.settingUtils.addItem({
      key: "totalSwitch",
      value: true,
      type: "checkbox",
      title: this.i18n.totalSwitch,
      description: this.i18n.totalSwitchDesc,
    });

    this.settingUtils.addItem({
        key: "hideMethod",
        value: 1,
        type: "select",
        title: this.i18n.hideMethodTitle,
        description: this.i18n.hideMethodDesc,
        options: {
            1: "CSS",
            2: "JS listener",
        },
    });
    this.settingUtils.addItem({
      key: "pluginBlacklist",
      value: "",
      type: "textarea",
      title: this.i18n.pluginBlacklistTitle,
      description: this.i18n.pluginBlacklistDesc,
    });
    this.settingUtils.addItem({
      key: "authorBlacklist",
      value: "",
      type: "textarea",
      title: this.i18n.authorBlacklistTitle,
      description: this.i18n.authorBlacklistDesc,
    });
    this.settingUtils.addItem({
      key: "pluginBlackListNotes",
      value: "",
      type: "textarea",
      title: this.i18n.pluginBlacklistNoteTitle,
      description: this.i18n.pluginBlacklistNoteDesc,
    });
    this.settingUtils.addItem({
      key: "hint",
      value: "",
      type: "hint",
      title: this.i18n.hintTitle,
      description: this.i18n.hintDesc,
    });
  }

  onLayoutReady() {
    this.loadData(STORAGE_NAME);
    this.settingUtils.load();

    if (this.settingUtils.get("totalSwitch")) {

        const _hideMethods_ = this.settingUtils.get("hideMethod");

        // console.log(typeof _hideMethods_);
        // fuck stupid type 巨坑，草


        switch (_hideMethods_) {
            case "1":
                // console.log("hide by CSS");
                this.rmvMarketPlaceCardsByNameCss(
                    this.convertStringToArray(this.settingUtils.get("pluginBlacklist"))
                );

                this.rmvMarketPlaceCardsByGitHubUsernameCss(
                    this.convertStringToArray(this.settingUtils.get("authorBlacklist"))
                );
                break;
            case "2":
                // console.log("hide by JS listener");
                this.rmvMarketPlaceCardsByNameJs(
                    this.convertStringToArray(this.settingUtils.get("pluginBlacklist"))
                );
                break;
            default:
                break;
        }
    }
  }

  async onunload() {
    await this.settingUtils.save();
    // this.reloadInterface();
  }

  uninstall() {
    this.removeData(STORAGE_NAME);
    showMessage(this.i18n.uninstall_hint);
  }
}
