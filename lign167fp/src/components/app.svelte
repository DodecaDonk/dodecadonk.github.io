<script>
    export let name = "World";
</script>

<main>
    <h1>Hello {name}!</h1>
    <p>Visit <a href="https://svelte.dev/tutorial"> Svelte tutorial</a> to learn how to build Svelte apps.</p>
    <input placeholder="What do you need to do?" value="" />
</main>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;700&display=swap');
    main {
        text-align: center;
        font-family: 'Nunito', sans-serif;
    }
    h1 {
        font-size: 72px;
        font-weight: 300;
    }
</style>
