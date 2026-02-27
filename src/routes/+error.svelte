<script lang="ts">
	import '../app.scss';

	import { page } from '$app/state';
</script>

<title>{page.status} | Catenary Maps</title>

<div class="flex flex-col max-w-md mx-auto h-screen justify-center items-center">
	<img src="/logo.svg" alt="Catenary Maps" class="logo w-24" />

	<div class="flex flex-col">
		<h1 class="error-code text-center">{page.status}</h1>
		<p class="message text-center font-mono">
			{page.error.message}
		</p>
		<a href="https://maps.catenarymaps.org" class="mx-auto text-center home-button"
			>Return to Central Station</a
		>
	</div>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

	* {
		font-family: 'Arimo', sans-serif;
	}

	.error-code {
		font-size: 6rem;
		font-weight: 600;
		margin-bottom: -10px;
		color: #00ab9b;
	}

	.message {
		font-size: 1.4rem;
		margin-bottom: 30px;
		max-width: 600px;
	}

	.home-button {
		background: #f3f3f3;
		color: black;
		padding: 10px 20px;
		border-radius: 5px;
		text-decoration: none;
		font-weight: 500;
		font-size: 1.2rem;
		transition:
			background-color 0.2s,
			color 0.2s;
		border: none;
		cursor: pointer;
	}

	.home-button:hover {
		background-color: #00ab9b;
		color: white;
	}
</style>
