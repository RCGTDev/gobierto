<template>
  <div class="gobierto-data-container-btn-download-data">
    <Button
      v-clickoutside="closeMenu"
      :text="labelDownloadData"
      icon="download"
      color="var(--color-base)"
      background="#fff"
      class="gobierto-data-btn-download-data"
      @click.native="isHidden = !isHidden"
    >
      <transition
        name="fade"
        mode="out-in"
      >
        <div
          v-show="!isHidden"
          class="gobierto-data-btn-download-data-modal"
        >
          <template
            v-for="(item, key, index) in arrayFormats"
          >
            <a
              :key="index"
              :item="item"
              :href="editor ? sqlfileCSV : item"
              :download="titleDataset"
              class="gobierto-data-btn-download-data-modal-element"
            >
              {{ key }}
            </a>
          </template>
        </div>
      </transition>
    </Button>
  </div>
</template>
<script>
import Button from "./Button.vue";
import { baseUrl, CommonsMixin } from "./../../../lib/commons.js";
export default {
  name: 'DownloadButton',
  components: {
    Button
  },
  mixins: [CommonsMixin],
  props: {
    editor: {
      type: Boolean,
      default: false
    },
    arrayFormats: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      labelDownloadData: "",
      isHidden: true,
      sqlfileCSV: '',
      sqlfileXLSX: '',
      sqlfileJSON: '',
      titleDataset: ''
    }
  },
  created() {
    this.labelDownloadData = I18n.t("gobierto_data.projects.downloadData")
  },
  methods: {
    closeMenu() {
      this.isHidden = true
    },
    updateCode(sqlQuery) {
      // TODO: this method do nothing
      const code = sqlQuery
      const endPointSQL = `${baseUrl}/data.csv?sql=`
      this.sqlfileCSV = `${endPointSQL}${code}&csv_separator=semicolon`
      this.sqlfileXLSX = `${endPointSQL}${code}`
      this.sqlfileJSON = `${endPointSQL}${code}`
    }
  }
}
</script>
