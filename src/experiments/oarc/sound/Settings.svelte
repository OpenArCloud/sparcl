<script lang="ts">
    /** Sound experiment has no dashboard options; Dashboard still uses bind:settings. */
    export let settings: Record<string, unknown> = {};
    $: Object.keys(settings);
</script>
