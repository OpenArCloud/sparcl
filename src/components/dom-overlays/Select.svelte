<script lang="ts" generics="T">
    export let options: T[] = [];
    export let displayFunc: (a: T) => string | undefined;
    export let value: T | null | undefined = undefined;
    export let fontSize = 18;
    /** Match a restored value to a newly built option. Defaults to reference equality. */
    export let equals: (option: T, current: T) => boolean = (option, current) => option === current;

    function resolveSelectIndex(list: T[], current: T | null | undefined, same: (option: T, current: T) => boolean): number {
        if (current == null || list.length === 0) {
            return 0;
        }
        const found = list.findIndex((option) => same(option, current));
        return found >= 0 ? found : 0;
    }

    // Follow the bound value. Do not write it from here: assigning options[0] on mount
    // was replacing a selection the user had already stored.
    let index = 0;
    $: index = resolveSelectIndex(options, value, equals);

    function onChange(event: Event) {
        const nextIndex = Number((event.currentTarget as HTMLSelectElement).value);
        const next = options[nextIndex];
        if (next !== undefined) {
            value = next;
        }
    }
</script>

<select style={`font-size: ${fontSize}px`} on:change={onChange}>
    {#each options as option, i}
        <option value={String(i)} selected={i === index}>{displayFunc(option) ?? ''}</option>
    {/each}
</select>
