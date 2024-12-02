<script>
    let name = "Ask a question!";
    let query = "";
    let queries = [

    ];
    function add(){
        queries = queries.concat(query);
        query = "";
    }
</script>

<main>
    <h1>SvelteGPT</h1>
    <input 
        placeholder={name}
        bind:value={query}
    />
    <button on:click={add}>
        Add new
    </button>

    {#each queries as query}
	<p>
		{query}
	</p>
{/each}

</main>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;700&display=swap');
    :root {
        --color-bg: /* Add a background color for the to-do app! */ ex: #f7f7f7;
        --color-outline: /* Add an outline color for the to-do app! */ ex: #c2c2c2;
        --color-shadow: /* Add a shadow for the to-do app! */ ex: hsl(0, 0%, 0%, 0.1);
        --color-text: /* Add a color for the text! */ ex: #222222;
    }

    *,
    *::before,
    *::after {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    main {
        height: 100%;
        display: grid;
        place-content: center;
        text-align: center;
        font-family: 'Nunito', sans-serif;
        font-weight: 300;
        line-height: 2;
        font-size: 24px;
        color: var(--color-text);
    }

    input,
    button {
        font-family: inherit;
        font-weight: inherit;
        line-height: inherit;
        font-size: 24px;
        width: 100%;
    }

    h1 {
        font-size: 72px;
        font-weight: 300;
        line-height: 2;
    }



</style>
